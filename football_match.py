"""
ENGLAND vs ARGENTINA — physics football match video generator.

Generates a vertical (1080x1920) 60fps MP4 of a physics-based football match
inside a circular arena, designed for YouTube Shorts / TikTok.

Everything is drawn procedurally with pygame (no image assets) and frames are
piped straight into ffmpeg via imageio-ffmpeg. The soundtrack (crowd ambience,
bounce thumps, referee whistles, goal cheers) is synthesized procedurally with
numpy from simulation events and muxed into the final MP4 — no audio assets.

Usage:  python3 football_match.py     ->  writes match.mp4
"""

import math
import os
import random
import subprocess
import wave

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")  # headless rendering

import numpy as np
import pygame
import imageio_ffmpeg

# ----------------------------------------------------------------------------
# CONSTANTS — tweak everything here
# ----------------------------------------------------------------------------
OUTPUT_FILE = "match.mp4"
WIDTH, HEIGHT = 1080, 1920
FPS = 60
VIDEO_SECONDS = 60          # total video length
END_CARD_SECONDS = 3        # last N seconds freeze on the final-score card
MATCH_SECONDS = VIDEO_SECONDS - END_CARD_SECONDS
PHYSICS_SUBSTEPS = 2        # physics steps per frame (anti-tunneling)

SEED = None                 # set an int for a reproducible match (overrides TARGET_SCORE)
TARGET_SCORE = (5, 4)       # desired final (ENGLAND, ARGENTINA) score, or None for random
SEED_SEARCH_LIMIT = 20000   # how many seeds to try when hunting TARGET_SCORE

ARENA_RADIUS = 450
ARENA_CENTER = (WIDTH // 2, 1000)
GOAL_GAP_DEG = 28           # arc width of each goal opening
NET_DEPTH = 56              # how far the net extends beyond the wall
POST_RADIUS = 12            # collision posts at the gap edges
SPIN_SPEED_DEG = 18.0       # arena rotation speed (degrees/second, clockwise)
WALL_SPIN_FRICTION = 0.25   # how much the moving wall drags a bouncing ball

GRAVITY = 900.0             # px / s^2
WALL_DAMPING = 0.98         # energy kept on wall bounce
BALL_RESTITUTION = 0.97     # energy kept on ball-ball bounce
MIN_SPEED = 260.0           # below this a ball gets a random kick
KICK_SPEED = (340.0, 540.0) # random-kick speed range
MAX_SPEED = 1700.0          # hard speed cap
FOOTBALL_SPAWN_SPEED = (650.0, 950.0)

FOOTBALL_RADIUS = 25
PLAYER_RADIUS = 40

TRAIL_LENGTH = 18           # positions kept per ball trail
TRAIL_ALPHA = 90            # max trail opacity

# Audio (all synthesized, no assets)
SAMPLE_RATE = 44100
CROWD_VOL = 0.16            # constant crowd ambience level
BOUNCE_VOL = 0.55           # wall/post bounce thump level
KICK_VOL = 0.50             # ball-ball kick level
CHEER_VOL = 0.90            # goal cheer level
WHISTLE_VOL = 0.40          # referee whistle level
SOUND_IMPACT_MIN = 220.0    # impacts quieter than this are inaudible
SOUND_MIN_GAP = 0.05        # per-sound-type rate limit (seconds)

GOAL_CELEBRATION_SECONDS = 1.0
SHAKE_GOAL = 20.0           # screen-shake strength on a goal
SHAKE_HIT_THRESHOLD = 850.0 # relative impact speed that starts shaking
SHAKE_DECAY = 0.85          # per-frame shake decay

# Colors
COL_BG_TOP = (14, 16, 26)
COL_BG_BOTTOM = (6, 8, 12)
COL_PITCH_A = (16, 64, 30)
COL_PITCH_B = (21, 78, 38)
COL_PITCH_LINE = (255, 255, 255, 38)
COL_WALL = (222, 222, 228)
COL_NET = (198, 198, 204)
COL_ENGLAND = (206, 30, 45)
COL_ENGLAND_FLASH = (255, 70, 80)
COL_ARGENTINA = (108, 171, 228)
COL_ARGENTINA_FLASH = (140, 195, 255)
COL_WHITE = (245, 245, 245)
COL_GOLD = (255, 215, 80)
COL_SUN = (246, 196, 64)
COL_TEXT = (240, 240, 245)

# Goal geometry: LEFT gap (180 deg) = England's goal, RIGHT gap (0 deg) = Argentina's.
GAP_HALF = GOAL_GAP_DEG / 2.0
LEFT_GAP_CENTER = 180.0
RIGHT_GAP_CENTER = 0.0


# ----------------------------------------------------------------------------
# Small geometry helpers (screen coords: +y is down, angles in degrees)
# ----------------------------------------------------------------------------
def polar(center, radius, deg):
    a = math.radians(deg)
    return (center[0] + radius * math.cos(a), center[1] + radius * math.sin(a))


def wrap_deg(a):
    return (a + 180.0) % 360.0 - 180.0


def angle_of(pos):
    return math.degrees(math.atan2(pos[1] - ARENA_CENTER[1], pos[0] - ARENA_CENTER[0]))


def in_gap(deg, gap_center):
    return abs(wrap_deg(deg - gap_center)) < GAP_HALF


def in_any_gap(deg):
    return in_gap(deg, LEFT_GAP_CENTER) or in_gap(deg, RIGHT_GAP_CENTER)


def seg_arc(surface, color, center, radius, a0, a1, width, step=3.0):
    """Draw an arc as a polyline (keeps one consistent y-down angle convention)."""
    pts = []
    a = a0
    while a < a1:
        pts.append(polar(center, radius, a))
        a += step
    pts.append(polar(center, radius, a1))
    pygame.draw.lines(surface, color, False, pts, width)


def regular_polygon(center, radius, sides, rot_deg):
    return [polar(center, radius, rot_deg + i * 360.0 / sides) for i in range(sides)]


def apply_circle_mask(surface):
    """Clip a square SRCALPHA surface to its inscribed circle."""
    size = surface.get_width()
    mask = pygame.Surface((size, size), pygame.SRCALPHA)
    pygame.draw.circle(mask, (255, 255, 255, 255), (size // 2, size // 2), size // 2)
    surface.blit(mask, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)


# ----------------------------------------------------------------------------
# Procedural ball textures (rendered at 2x, scaled down while rotating)
# ----------------------------------------------------------------------------
def make_football_texture(radius):
    s = radius * 4  # 2x supersampled
    r = s // 2
    surf = pygame.Surface((s, s), pygame.SRCALPHA)
    pygame.draw.circle(surf, COL_WHITE, (r, r), r)
    black = (25, 25, 28)
    # Classic pattern: one center pentagon + 5 around the rim, clipped by the circle
    pygame.draw.polygon(surf, black, regular_polygon((r, r), r * 0.40, 5, -90))
    for i in range(5):
        a = -90 + 36 + i * 72
        c = polar((r, r), r * 0.97, a)
        pygame.draw.polygon(surf, black, regular_polygon(c, r * 0.34, 5, a + 36))
        pygame.draw.line(surf, black, polar((r, r), r * 0.40, -90 + i * 72), c, 3)
    apply_circle_mask(surf)
    pygame.draw.circle(surf, black, (r, r), r, 4)
    return surf


def make_england_texture(radius):
    """England flag: St George's cross — red cross on white."""
    s = radius * 4
    r = s // 2
    surf = pygame.Surface((s, s), pygame.SRCALPHA)
    pygame.draw.circle(surf, COL_WHITE, (r, r), r)
    bar = int(s * 0.16)
    pygame.draw.rect(surf, COL_ENGLAND, (r - bar // 2, 0, bar, s))
    pygame.draw.rect(surf, COL_ENGLAND, (0, r - bar // 2, s, bar))
    apply_circle_mask(surf)
    pygame.draw.circle(surf, (120, 20, 30), (r, r), r, 5)
    return surf


def make_argentina_texture(radius):
    """Argentina flag: light blue / white / light blue stripes + Sun of May."""
    s = radius * 4
    r = s // 2
    surf = pygame.Surface((s, s), pygame.SRCALPHA)
    third = s // 3
    pygame.draw.rect(surf, COL_ARGENTINA, (0, 0, s, third))
    pygame.draw.rect(surf, COL_WHITE, (0, third, s, third))
    pygame.draw.rect(surf, COL_ARGENTINA, (0, 2 * third, s, s - 2 * third))
    # Sun of May: gold disc + 16 rays
    sun_r = int(s * 0.13)
    for i in range(16):
        tip = polar((r, r), sun_r * 1.85, i * 22.5)
        pygame.draw.line(surf, COL_SUN, (r, r), tip, 4)
    pygame.draw.circle(surf, COL_SUN, (r, r), sun_r)
    pygame.draw.circle(surf, (190, 140, 30), (r, r), sun_r, 3)
    apply_circle_mask(surf)
    pygame.draw.circle(surf, (60, 110, 165), (r, r), r, 5)
    return surf


# ----------------------------------------------------------------------------
# Static background (gradient + bokeh) and the rotating arena ring
# ----------------------------------------------------------------------------
def make_background():
    bg = pygame.Surface((WIDTH, HEIGHT))
    # Vertical gradient
    for y in range(HEIGHT):
        t = y / HEIGHT
        col = [int(COL_BG_TOP[i] + (COL_BG_BOTTOM[i] - COL_BG_TOP[i]) * t) for i in range(3)]
        pygame.draw.line(bg, col, (0, y), (WIDTH, y))
    # Dim "blurred stadium" bokeh outside the arena
    layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    rng = random.Random(7)
    for _ in range(170):
        x, y = rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT)
        if math.hypot(x - ARENA_CENTER[0], y - ARENA_CENTER[1]) < ARENA_RADIUS + 90:
            continue
        rad = rng.randint(3, 16)
        col = rng.choice([(255, 230, 180), (180, 200, 255), (255, 255, 255)])
        pygame.draw.circle(layer, (*col, rng.randint(8, 26)), (int(x), int(y)), rad)
    bg.blit(layer, (0, 0))
    return bg


def make_arena_ring():
    """Pitch + wall + goals on one square surface, rotated as a whole each frame."""
    margin = NET_DEPTH + 16
    s = 2 * (ARENA_RADIUS + margin)
    c = (s // 2, s // 2)
    ring = pygame.Surface((s, s), pygame.SRCALPHA)

    # Pitch: dark green circle with mowed stripes + faint markings
    d = ARENA_RADIUS * 2
    pitch = pygame.Surface((d, d), pygame.SRCALPHA)
    pygame.draw.circle(pitch, COL_PITCH_A, (ARENA_RADIUS, ARENA_RADIUS), ARENA_RADIUS)
    stripe_h = 64
    for i, y in enumerate(range(0, d, stripe_h)):
        if i % 2 == 0:
            pygame.draw.rect(pitch, COL_PITCH_B, (0, y, d, stripe_h))
    apply_circle_mask(pitch)
    # markings (drawn inside the already-masked circle)
    pygame.draw.circle(pitch, COL_PITCH_LINE, (ARENA_RADIUS, ARENA_RADIUS), 105, 3)
    pygame.draw.circle(pitch, COL_PITCH_LINE, (ARENA_RADIUS, ARENA_RADIUS), 6)
    pygame.draw.line(pitch, COL_PITCH_LINE, (ARENA_RADIUS, 0), (ARENA_RADIUS, d), 3)
    ring.blit(pitch, (c[0] - ARENA_RADIUS, c[1] - ARENA_RADIUS))

    # Nets + goal frames (behind the wall so balls fly "into" them)
    for gap_center, col in ((LEFT_GAP_CENTER, COL_ENGLAND), (RIGHT_GAP_CENTER, COL_ARGENTINA)):
        a0, a1 = gap_center - GAP_HALF, gap_center + GAP_HALF
        # net: radial strings + concentric strings
        a = a0
        while a <= a1 + 0.1:
            pygame.draw.line(ring, COL_NET, polar(c, ARENA_RADIUS, a),
                             polar(c, ARENA_RADIUS + NET_DEPTH, a), 2)
            a += 7
        for rr in (18, 36, 54):
            seg_arc(ring, COL_NET, c, ARENA_RADIUS + rr, a0, a1, 2)
        # colored frame: two posts + crossbar arc + white accent
        for edge in (a0, a1):
            pygame.draw.line(ring, col, polar(c, ARENA_RADIUS - 6, edge),
                             polar(c, ARENA_RADIUS + NET_DEPTH, edge), 10)
        seg_arc(ring, col, c, ARENA_RADIUS + NET_DEPTH, a0, a1, 12)
        seg_arc(ring, COL_WHITE, c, ARENA_RADIUS + NET_DEPTH + 9, a0, a1, 4)

    # Arena wall (two arcs between the gaps) + collision posts at gap edges
    seg_arc(ring, COL_WALL, c, ARENA_RADIUS,
            RIGHT_GAP_CENTER + GAP_HALF, LEFT_GAP_CENTER - GAP_HALF, 10)
    seg_arc(ring, COL_WALL, c, ARENA_RADIUS,
            LEFT_GAP_CENTER + GAP_HALF, 360.0 - GAP_HALF, 10)
    for gap_center in (LEFT_GAP_CENTER, RIGHT_GAP_CENTER):
        for edge in (gap_center - GAP_HALF, gap_center + GAP_HALF):
            p = polar(c, ARENA_RADIUS, edge)
            pygame.draw.circle(ring, COL_WHITE, (int(p[0]), int(p[1])), POST_RADIUS)
            pygame.draw.circle(ring, (60, 60, 70), (int(p[0]), int(p[1])), POST_RADIUS, 3)
    return ring


def draw_arena(canvas, background, ring, rot_deg):
    canvas.blit(background, (0, 0))
    # +rot in our y-down angle convention is clockwise on screen; pygame rotates
    # counterclockwise for positive angles, so rotate by -rot.
    rotated = pygame.transform.rotozoom(ring, -rot_deg, 1.0)
    canvas.blit(rotated, rotated.get_rect(center=ARENA_CENTER))


# ----------------------------------------------------------------------------
# Physics objects
# ----------------------------------------------------------------------------
class Ball:
    def __init__(self, pos, vel, radius, texture, trail_color, is_football=False):
        self.pos = list(pos)
        self.vel = list(vel)
        self.r = radius
        self.mass = radius * radius
        self.texture = texture
        self.trail_color = trail_color
        self.is_football = is_football
        self.angle = 0.0
        self.trail = []

    @property
    def speed(self):
        return math.hypot(self.vel[0], self.vel[1])

    def push_trail(self):
        self.trail.append(tuple(self.pos))
        if len(self.trail) > TRAIL_LENGTH:
            self.trail.pop(0)

    def draw(self, surface):
        img = pygame.transform.rotozoom(self.texture, self.angle, 0.5)
        surface.blit(img, img.get_rect(center=(int(self.pos[0]), int(self.pos[1]))))


def random_velocity(speed_range):
    a = random.uniform(0, 2 * math.pi)
    s = random.uniform(*speed_range)
    return [s * math.cos(a), s * math.sin(a)]


def clamp_speed(ball):
    s = ball.speed
    if s > MAX_SPEED:
        k = MAX_SPEED / s
        ball.vel[0] *= k
        ball.vel[1] *= k


def step_ball(ball, dt, posts, rot_deg):
    """Integrate one ball; returns (impact_speed, goal_gap_center or None).

    rot_deg is the arena's current rotation: gap positions and the wall's
    surface velocity follow it.
    """
    impact = 0.0
    goal = None

    ball.vel[1] += GRAVITY * dt
    clamp_speed(ball)
    ball.pos[0] += ball.vel[0] * dt
    ball.pos[1] += ball.vel[1] * dt
    # rolling-look rotation from horizontal velocity
    ball.angle -= math.degrees(ball.vel[0] / ball.r) * dt

    dx = ball.pos[0] - ARENA_CENTER[0]
    dy = ball.pos[1] - ARENA_CENTER[1]
    dist = math.hypot(dx, dy) or 1e-9

    if dist + ball.r > ARENA_RADIUS:
        deg_rel = math.degrees(math.atan2(dy, dx)) - rot_deg  # angle in arena frame
        if ball.is_football and in_any_gap(deg_rel):
            # football flies into the net -> goal once fully across the line
            if dist > ARENA_RADIUS + ball.r * 0.6:
                goal = RIGHT_GAP_CENTER if in_gap(deg_rel, RIGHT_GAP_CENTER) else LEFT_GAP_CENTER
        else:
            # bounce off the wall (player balls also bounce inside the gaps: net)
            nx, ny = dx / dist, dy / dist
            vn = ball.vel[0] * nx + ball.vel[1] * ny
            if vn > 0:
                impact = vn
                ball.vel[0] -= 2 * vn * nx
                ball.vel[1] -= 2 * vn * ny
                ball.vel[0] *= WALL_DAMPING
                ball.vel[1] *= WALL_DAMPING
            # the spinning wall drags the ball a little along its surface
            tx, ty = -ny, nx
            wall_t = math.radians(SPIN_SPEED_DEG) * ARENA_RADIUS
            ball_t = ball.vel[0] * tx + ball.vel[1] * ty
            drag = WALL_SPIN_FRICTION * (wall_t - ball_t)
            ball.vel[0] += drag * tx
            ball.vel[1] += drag * ty
            k = ARENA_RADIUS - ball.r
            ball.pos[0] = ARENA_CENTER[0] + nx * k
            ball.pos[1] = ARENA_CENTER[1] + ny * k

    # goal posts (static circles)
    for px, py in posts:
        ddx, ddy = ball.pos[0] - px, ball.pos[1] - py
        d = math.hypot(ddx, ddy) or 1e-9
        min_d = ball.r + POST_RADIUS
        if d < min_d:
            nx, ny = ddx / d, ddy / d
            vn = ball.vel[0] * nx + ball.vel[1] * ny
            if vn < 0:
                impact = max(impact, -vn)
                ball.vel[0] -= 2 * vn * nx
                ball.vel[1] -= 2 * vn * ny
                ball.vel[0] *= WALL_DAMPING
                ball.vel[1] *= WALL_DAMPING
            ball.pos[0] = px + nx * min_d
            ball.pos[1] = py + ny * min_d

    # never let a ball die: random kick when too slow
    if ball.speed < MIN_SPEED:
        kick = random_velocity(KICK_SPEED)
        ball.vel[0] += kick[0]
        ball.vel[1] += kick[1] - 120  # slight upward bias looks livelier
    return impact, goal


def collide_pair(a, b):
    """Elastic collision between two balls; returns impact speed."""
    dx, dy = b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]
    d = math.hypot(dx, dy) or 1e-9
    min_d = a.r + b.r
    if d >= min_d:
        return 0.0
    nx, ny = dx / d, dy / d
    # separate (weighted by inverse mass)
    overlap = min_d - d
    inv_a, inv_b = 1.0 / a.mass, 1.0 / b.mass
    total = inv_a + inv_b
    a.pos[0] -= nx * overlap * inv_a / total
    a.pos[1] -= ny * overlap * inv_a / total
    b.pos[0] += nx * overlap * inv_b / total
    b.pos[1] += ny * overlap * inv_b / total
    # impulse
    vn = (a.vel[0] - b.vel[0]) * nx + (a.vel[1] - b.vel[1]) * ny
    if vn <= 0:
        return 0.0
    j = (1 + BALL_RESTITUTION) * vn / total
    a.vel[0] -= j * inv_a * nx
    a.vel[1] -= j * inv_a * ny
    b.vel[0] += j * inv_b * nx
    b.vel[1] += j * inv_b * ny
    return vn


# ----------------------------------------------------------------------------
# Procedural audio: every sound is synthesized from the event log
# ----------------------------------------------------------------------------
def _mix_at(buf, start_s, w):
    i = int(start_s * SAMPLE_RATE)
    if i < 0 or i >= len(buf):
        return
    j = min(len(buf), i + len(w))
    buf[i:j] += w[:j - i]


def _fft_shaped_noise(n, gain_fn, rng):
    """White noise spectrally shaped by gain_fn(freqs) via FFT filtering."""
    noise = rng.standard_normal(n)
    spec = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(n, 1.0 / SAMPLE_RATE)
    freqs[0] = 1.0
    w = np.fft.irfft(spec * gain_fn(freqs), n)
    return w / (np.max(np.abs(w)) + 1e-9)


def _synth_thump(freq, decay, dur, vol):
    """Low percussive hit: pitch-dropping sine + a tiny noise click."""
    t = np.arange(int(dur * SAMPLE_RATE)) / SAMPLE_RATE
    w = np.sin(2 * np.pi * freq * t * (1.0 - 0.25 * t / dur)) * np.exp(-t * decay)
    click = np.random.default_rng(3).standard_normal(len(t)) * np.exp(-t * 220) * 0.4
    return (w + click) * vol


def _synth_whistle(blasts, vol):
    """Referee whistle: 2.4kHz tone with fast vibrato; blasts = [(offset, dur)]."""
    total = max(o + d for o, d in blasts) + 0.05
    out = np.zeros(int(total * SAMPLE_RATE))
    for offset, dur in blasts:
        t = np.arange(int(dur * SAMPLE_RATE)) / SAMPLE_RATE
        tone = np.sin(2 * np.pi * 2400 * t + 3.0 * np.sin(2 * np.pi * 24 * t))
        env = np.minimum(t / 0.015, 1.0) * np.minimum((dur - t) / 0.05, 1.0).clip(0, 1)
        _mix_at(out, offset, tone * env)
    return out * vol


def _synth_cheer(dur, vol, seed):
    """Crowd roar: band-shaped noise swelling fast and decaying slowly."""
    n = int(dur * SAMPLE_RATE)
    rng = np.random.default_rng(seed)
    roar = _fft_shaped_noise(n, lambda f: np.exp(-0.5 * (np.log(f / 700.0) / 0.9) ** 2), rng)
    t = np.arange(n) / SAMPLE_RATE
    env = np.clip(t / 0.18, 0, 1) ** 1.5 * np.exp(-np.maximum(0.0, t - 0.5) * 1.3)
    return roar * env * vol


def build_soundtrack(events, total_seconds):
    """Mix the event log into a mono float track for the whole video."""
    n = int(total_seconds * SAMPLE_RATE)
    buf = np.zeros(n)

    # constant stadium ambience: low-passed noise, slowly breathing
    rng = np.random.default_rng(1)
    crowd = _fft_shaped_noise(n, lambda f: 1.0 / (1.0 + (f / 450.0) ** 2), rng)
    crowd /= np.std(crowd) + 1e-9
    t = np.arange(n) / SAMPLE_RATE
    swell = 1.0 + 0.22 * np.sin(2 * np.pi * 0.11 * t) + 0.13 * np.sin(2 * np.pi * 0.043 * t + 1.7)
    buf += crowd * swell * CROWD_VOL * 0.3

    for when, kind, intensity in events:
        if kind == "bounce":
            v = BOUNCE_VOL * (0.25 + 0.75 * min(1.0, intensity / 1300.0))
            _mix_at(buf, when, _synth_thump(140, 34, 0.14, v))
        elif kind == "kick":
            v = KICK_VOL * (0.25 + 0.75 * min(1.0, intensity / 1300.0))
            _mix_at(buf, when, _synth_thump(210, 48, 0.09, v))
        elif kind == "whistle":
            _mix_at(buf, when, _synth_whistle([(0.0, 0.35)], WHISTLE_VOL))
        elif kind == "whistle_full_time":
            _mix_at(buf, when, _synth_whistle(
                [(0.0, 0.25), (0.4, 0.25), (0.8, 0.8)], WHISTLE_VOL))
        elif kind == "cheer":
            _mix_at(buf, when, _synth_cheer(2.8, CHEER_VOL, int(when * 1000) & 0xFFFF))

    peak = np.max(np.abs(buf))
    if peak > 0.85:
        buf *= 0.85 / peak
    return buf


def write_wav(path, track):
    data = (track * 32767).astype(np.int16)
    stereo = np.repeat(data[:, None], 2, axis=1)
    with wave.open(path, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SAMPLE_RATE)
        f.writeframes(stereo.tobytes())


def mux_audio(video_path, wav_path, out_path):
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(
        [ffmpeg, "-y", "-i", video_path, "-i", wav_path,
         "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", out_path],
        check=True, capture_output=True)


# ----------------------------------------------------------------------------
# HUD / overlays
# ----------------------------------------------------------------------------
def draw_hud(canvas, fonts, score_e, score_a, t):
    title = fonts["title"].render("ENGLAND vs ARGENTINA", True, COL_TEXT)
    canvas.blit(title, title.get_rect(center=(WIDTH // 2, 120)))

    col_e = COL_GOLD if score_e > score_a else COL_WHITE
    col_a = COL_GOLD if score_a > score_e else COL_WHITE
    pieces = [
        fonts["name"].render("ENGLAND", True, COL_ENGLAND_FLASH),
        fonts["score"].render(f" {score_e} ", True, col_e),
        fonts["score"].render("-", True, (150, 150, 160)),
        fonts["score"].render(f" {score_a} ", True, col_a),
        fonts["name"].render("ARGENTINA", True, COL_ARGENTINA_FLASH),
    ]
    total_w = sum(p.get_width() for p in pieces)
    x = (WIDTH - total_w) // 2
    for p in pieces:
        canvas.blit(p, p.get_rect(midleft=(x, 235)))
        x += p.get_width()

    bob = math.sin(t * 3.0) * 6
    cta = fonts["cta"].render("Who wins? Comment your guess!", True, COL_GOLD)
    canvas.blit(cta, cta.get_rect(center=(WIDTH // 2, 1815 + bob)))


def draw_goal_celebration(canvas, fonts, team_color, progress):
    """progress: 0 -> 1 over the celebration."""
    flash = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    flash.fill((*team_color, int(170 * max(0.0, 1.0 - progress * 1.6))))
    canvas.blit(flash, (0, 0))
    pulse = 1.0 + 0.08 * math.sin(progress * math.pi * 8)
    txt = fonts["goal"].render("GOAL!", True, COL_WHITE)
    glow = fonts["goal"].render("GOAL!", True, team_color)
    txt = pygame.transform.rotozoom(txt, 0, pulse)
    glow = pygame.transform.rotozoom(glow, 0, pulse * 1.06)
    canvas.blit(glow, glow.get_rect(center=(WIDTH // 2, ARENA_CENTER[1])))
    canvas.blit(txt, txt.get_rect(center=(WIDTH // 2, ARENA_CENTER[1])))


def draw_final_card(canvas, fonts, score_e, score_a):
    overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    overlay.fill((5, 6, 10, 205))
    canvas.blit(overlay, (0, 0))
    if score_e > score_a:
        winner, wcol = "ENGLAND WINS!", COL_ENGLAND_FLASH
    elif score_a > score_e:
        winner, wcol = "ARGENTINA WINS!", COL_ARGENTINA_FLASH
    else:
        winner, wcol = "IT'S A DRAW!", COL_GOLD
    ft = fonts["title"].render("FULL TIME", True, COL_GOLD)
    sc = fonts["final"].render(f"{score_e} - {score_a}", True, COL_WHITE)
    wn = fonts["winner"].render(winner, True, wcol)
    names = fonts["name"].render("ENGLAND  vs  ARGENTINA", True, COL_TEXT)
    canvas.blit(ft, ft.get_rect(center=(WIDTH // 2, 760)))
    canvas.blit(names, names.get_rect(center=(WIDTH // 2, 880)))
    canvas.blit(sc, sc.get_rect(center=(WIDTH // 2, 1030)))
    canvas.blit(wn, wn.get_rect(center=(WIDTH // 2, 1200)))


def draw_trails(canvas, balls):
    layer = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
    for ball in balls:
        n = len(ball.trail)
        for i, (x, y) in enumerate(ball.trail):
            f = (i + 1) / n
            alpha = int(TRAIL_ALPHA * f)
            rad = max(2, int(ball.r * (0.30 + 0.55 * f)))
            pygame.draw.circle(layer, (*ball.trail_color, alpha), (int(x), int(y)), rad)
    canvas.blit(layer, (0, 0))


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def run_match(render=True, verbose=True):
    """Run one match with the current global random state.

    render=False skips all drawing/encoding and only simulates the physics —
    used to search for a seed that produces TARGET_SCORE. Physics consumes the
    global `random` stream identically in both modes (visual effects draw from
    their own RNG), so a simulated seed replays exactly when rendered.
    """
    visual_rng = random.Random(99)  # shake offsets etc: never touches physics

    pygame.init()
    if render:
        fonts = {
            "title": pygame.font.Font(None, 82),
            "name": pygame.font.Font(None, 52),
            "score": pygame.font.Font(None, 92),
            "cta": pygame.font.Font(None, 56),
            "goal": pygame.font.Font(None, 230),
            "final": pygame.font.Font(None, 190),
            "winner": pygame.font.Font(None, 96),
        }
        background = make_background()
        ring = make_arena_ring()

    football = Ball(ARENA_CENTER, random_velocity(FOOTBALL_SPAWN_SPEED),
                    FOOTBALL_RADIUS, make_football_texture(FOOTBALL_RADIUS),
                    (255, 255, 255), is_football=True)
    england = Ball((ARENA_CENTER[0] - 210, ARENA_CENTER[1] - 40),
                   random_velocity((400, 700)), PLAYER_RADIUS,
                   make_england_texture(PLAYER_RADIUS), COL_ENGLAND_FLASH)
    argentina = Ball((ARENA_CENTER[0] + 210, ARENA_CENTER[1] - 40),
                     random_velocity((400, 700)), PLAYER_RADIUS,
                     make_argentina_texture(PLAYER_RADIUS), COL_ARGENTINA_FLASH)
    balls = [football, england, argentina]

    score_e = score_a = 0
    goal_timer = 0.0
    goal_team_color = COL_WHITE
    shake = 0.0

    sound_events = []           # (time, kind, intensity)
    last_sound_time = {}

    def add_sound(when, kind, intensity=1.0):
        if when - last_sound_time.get(kind, -1.0) >= SOUND_MIN_GAP:
            last_sound_time[kind] = when
            sound_events.append((when, kind, intensity))

    if render:
        tmp_video = OUTPUT_FILE + ".video.tmp.mp4"
        tmp_wav = OUTPUT_FILE + ".audio.tmp.wav"
        writer = imageio_ffmpeg.write_frames(
            tmp_video, size=(WIDTH, HEIGHT), fps=FPS, quality=8, macro_block_size=1)
        writer.send(None)
        frame = pygame.Surface((WIDTH, HEIGHT))
        canvas = pygame.Surface((WIDTH, HEIGHT))
        print(f"Rendering {VIDEO_SECONDS}s @ {FPS}fps -> {OUTPUT_FILE}")
    add_sound(0.15, "whistle")  # kickoff

    total_match_frames = MATCH_SECONDS * FPS
    dt = 1.0 / (FPS * PHYSICS_SUBSTEPS)
    for f in range(total_match_frames):
        t = f / FPS
        rot = (SPIN_SPEED_DEG * t) % 360.0
        posts = [polar(ARENA_CENTER, ARENA_RADIUS, gc + e + rot)
                 for gc in (LEFT_GAP_CENTER, RIGHT_GAP_CENTER) for e in (-GAP_HALF, GAP_HALF)]

        # ----- physics -----
        for _ in range(PHYSICS_SUBSTEPS):
            active = [b for b in balls if not (b.is_football and goal_timer > 0)]
            for ball in active:
                impact, goal = step_ball(ball, dt, posts, rot)
                if impact > SOUND_IMPACT_MIN:
                    add_sound(t, "bounce", impact)
                if impact > SHAKE_HIT_THRESHOLD:
                    shake = max(shake, min(14.0, (impact - SHAKE_HIT_THRESHOLD) / 70.0))
                if goal is not None and goal_timer <= 0:
                    if goal == RIGHT_GAP_CENTER:   # into Argentina's goal
                        score_e += 1
                        goal_team_color = COL_ENGLAND_FLASH
                        scorer = "ENGLAND"
                    else:                          # into England's goal
                        score_a += 1
                        goal_team_color = COL_ARGENTINA_FLASH
                        scorer = "ARGENTINA"
                    goal_timer = GOAL_CELEBRATION_SECONDS
                    shake = SHAKE_GOAL
                    add_sound(t, "cheer")
                    if verbose:
                        print(f"[SOUND] crowd cheer")
                        print(f"  {t:5.1f}s  GOAL! {scorer} scores "
                              f"-> ENGLAND {score_e} - {score_a} ARGENTINA")
            for i in range(len(active)):
                for j in range(i + 1, len(active)):
                    impact = collide_pair(active[i], active[j])
                    if impact > SOUND_IMPACT_MIN:
                        add_sound(t, "kick", impact)
                    if impact > SHAKE_HIT_THRESHOLD:
                        shake = max(shake, min(14.0, (impact - SHAKE_HIT_THRESHOLD) / 70.0))

        # celebration countdown -> reset football to center
        if goal_timer > 0:
            goal_timer -= 1.0 / FPS
            if goal_timer <= 0:
                football.pos = list(ARENA_CENTER)
                football.vel = random_velocity(FOOTBALL_SPAWN_SPEED)
                football.trail.clear()
                add_sound(t, "whistle")  # restart after the goal

        if not render:
            continue

        for ball in balls:
            if not (ball.is_football and goal_timer > 0):
                ball.push_trail()

        # ----- render -----
        draw_arena(canvas, background, ring, rot)
        draw_trails(canvas, [b for b in balls if not (b.is_football and goal_timer > 0)])
        for ball in balls:
            if ball.is_football and goal_timer > 0:
                continue
            ball.draw(canvas)
        draw_hud(canvas, fonts, score_e, score_a, t)
        if goal_timer > 0:
            draw_goal_celebration(canvas, fonts, goal_team_color,
                                  1.0 - goal_timer / GOAL_CELEBRATION_SECONDS)

        frame.fill(COL_BG_BOTTOM)
        ox = oy = 0
        if shake > 0.5:
            ox = visual_rng.randint(-int(shake), int(shake))
            oy = visual_rng.randint(-int(shake), int(shake))
        shake *= SHAKE_DECAY
        frame.blit(canvas, (ox, oy))
        writer.send(pygame.image.tobytes(frame, "RGB"))

        if f % (FPS * 10) == 0:
            print(f"  ... {t:4.0f}s / {MATCH_SECONDS}s  "
                  f"(ENGLAND {score_e} - {score_a} ARGENTINA)")

    if not render:
        return score_e, score_a

    # ----- frozen final-score card -----
    draw_arena(canvas, background, ring, (SPIN_SPEED_DEG * MATCH_SECONDS) % 360.0)
    draw_trails(canvas, balls)
    for ball in balls:
        ball.draw(canvas)
    draw_hud(canvas, fonts, score_e, score_a, MATCH_SECONDS)
    draw_final_card(canvas, fonts, score_e, score_a)
    card_bytes = pygame.image.tobytes(canvas, "RGB")
    for _ in range(END_CARD_SECONDS * FPS):
        writer.send(card_bytes)

    writer.close()
    pygame.quit()

    # full-time whistle + crowd reaction, then mux the soundtrack into the video
    sound_events.append((MATCH_SECONDS - 0.2, "whistle_full_time", 1.0))
    sound_events.append((MATCH_SECONDS, "cheer", 1.0))
    print(f"[AUDIO] synthesizing soundtrack ({len(sound_events)} events)...")
    write_wav(tmp_wav, build_soundtrack(sound_events, VIDEO_SECONDS))
    mux_audio(tmp_video, tmp_wav, OUTPUT_FILE)
    os.remove(tmp_video)
    os.remove(tmp_wav)

    if score_e > score_a:
        result = "ENGLAND WINS!"
    elif score_a > score_e:
        result = "ARGENTINA WINS!"
    else:
        result = "IT'S A DRAW!"
    print(f"\nDone -> {OUTPUT_FILE}")
    print(f"FINAL SCORE: ENGLAND {score_e} - {score_a} ARGENTINA  ({result})")
    return score_e, score_a


def find_seed_for_score(target):
    """Simulate matches (no rendering) until one ends with the target score."""
    print(f"Searching for a seed that ends ENGLAND {target[0]} - {target[1]} ARGENTINA ...")
    for seed in range(SEED_SEARCH_LIMIT):
        random.seed(seed)
        score = run_match(render=False, verbose=False)
        if seed % 25 == 0 or score == target:
            print(f"  seed {seed:4d}: ENGLAND {score[0]} - {score[1]} ARGENTINA")
        if score == target:
            print(f"Found seed {seed}.")
            return seed
    raise SystemExit(
        f"No seed below {SEED_SEARCH_LIMIT} gives {target[0]}-{target[1]}; "
        "adjust TARGET_SCORE or raise SEED_SEARCH_LIMIT.")


def main():
    if SEED is not None:
        seed = SEED
    elif TARGET_SCORE is not None:
        seed = find_seed_for_score(TARGET_SCORE)
    else:
        seed = random.randrange(1 << 30)
    print(f"Match seed: {seed}")
    random.seed(seed)
    run_match()


if __name__ == "__main__":
    main()

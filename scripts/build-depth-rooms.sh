#!/usr/bin/env bash
# Build depth-parallax room assets (stable/decayed composites + depth maps).
#
# Depth map convention: white = near camera, black = far. Each room is a
# one-point-perspective box described by four numbers — the back-wall corner
# columns (LC/RC) and the ceiling/floor junction rows (CY/FY) — plus
# furniture cutouts stamped at their plane depth using each layer's alpha.
# Hand-refine any depth.png in Photoshop/Procreate afterwards; this script
# only provides the first pass. Requires ImageMagick 7.
set -euo pipefail
cd "$(dirname "$0")/../public/rooms"

W=2048 H=1152
BLUR=0x4

# ---- helpers ---------------------------------------------------------------

# wall_quads <LC> <RC> <CY> <FY> -> emits ceiling/floor/left/right plane PNGs
build_box() {
  local LC=$1 RC=$2 CY=$3 FY=$4 out=$5
  magick -size ${W}x${H} canvas:'#1f1f1f' /tmp/dr_back.png
  magick -size ${W}x${CY} gradient:'#999999-#212121' -virtual-pixel transparent \
    +distort Perspective "0,0 0,0  $((W-1)),0 ${W},0  $((W-1)),$((CY-1)) ${RC},${CY}  0,$((CY-1)) ${LC},${CY}" /tmp/dr_ceil.png
  magick -size ${W}x$((H-FY)) gradient:'#212121-#f2f2f2' -virtual-pixel transparent \
    +distort Perspective "0,0 ${LC},${FY}  $((W-1)),0 ${RC},${FY}  $((W-1)),$((H-FY-1)) ${W},${H}  0,$((H-FY-1)) 0,${H}" /tmp/dr_floor.png
  magick -size ${LC}x${H} -define gradient:direction=east gradient:'#d9d9d9-#212121' -virtual-pixel transparent \
    +distort Perspective "0,0 0,0  $((LC-1)),0 ${LC},${CY}  $((LC-1)),$((H-1)) ${LC},${FY}  0,$((H-1)) 0,${H}" /tmp/dr_lwall.png
  magick -size $((W-RC))x${H} -define gradient:direction=east gradient:'#212121-#d9d9d9' -virtual-pixel transparent \
    +distort Perspective "0,0 ${RC},${CY}  $((W-RC-1)),0 ${W},0  $((W-RC-1)),$((H-1)) ${W},${H}  0,$((H-1)) ${RC},${FY}" /tmp/dr_rwall.png
  magick /tmp/dr_back.png /tmp/dr_ceil.png -layers merge /tmp/dr_floor.png -layers merge \
    /tmp/dr_lwall.png -layers merge /tmp/dr_rwall.png -layers merge "$out"
}

# stamp_furniture <base> <layer.webp> <gradTop> <gradBottom> <out>
stamp() {
  local base=$1 layer=$2 g1=$3 g2=$4 out=$5
  magick "$layer" -alpha extract -threshold 35% /tmp/dr_mask.png
  magick -size ${W}x${H} gradient:"${g1}-${g2}" /tmp/dr_mask.png -alpha off -compose CopyOpacity -composite /tmp/dr_stamp.png
  magick "$base" /tmp/dr_stamp.png -composite "$out"
}

# ---- observation -----------------------------------------------------------
# (stable.png comes from the artist's clean original; decayed from Dirty_room)
mkdir -p observation/depth
magick observation/Dirty_room_2048.webp observation/Desk_2048.webp -composite observation/depth/decayed.png
build_box 600 1630 85 600 /tmp/dr_obs.png
magick /tmp/dr_obs.png -fill '#0d0d0d' -draw 'rectangle 620,147 1265,550' \
  -fill '#787878' -draw 'rectangle 1545,280 1640,430' \
  -fill '#c4c4c4' -draw 'ellipse 170,60 120,55 0,360' -draw 'ellipse 1880,60 120,55 0,360' /tmp/dr_obs.png
# bookshelf + rack planes
magick -size 260x745 -define gradient:direction=east gradient:'#7a7a7a-#3d3d3d' -virtual-pixel transparent \
  +distort Perspective '0,0 350,115  259,0 610,150  259,744 610,800  0,744 350,860' /tmp/dr_shelf.png
magick -size 230x545 -define gradient:direction=east gradient:'#3d3d3d-#6e6e6e' /tmp/dr_rack.png
magick /tmp/dr_obs.png /tmp/dr_shelf.png -layers merge /tmp/dr_rack.png -geometry +1350+165 -composite /tmp/dr_obs.png
stamp /tmp/dr_obs.png observation/Desk_2048.webp '#737373' '#b3b3b3' /tmp/dr_obs.png
magick /tmp/dr_obs.png -blur $BLUR observation/depth/depth.png

# ---- break-room ------------------------------------------------------------
mkdir -p break-room/depth
magick break-room/Break_room_main_2048.webp break-room/Break_Room_table_2048.webp -composite \
  break-room/Break_Room_couch_2048.webp -composite break-room/depth/stable.png
magick break-room/break_room_dirty_2048.webp break-room/Break_Room_table_2048.webp -composite \
  break-room/Break_Room_couch_2048.webp -composite break-room/depth/decayed.png
build_box 650 1351 113 707 /tmp/dr_break.png
magick /tmp/dr_break.png \
  -fill '#383838' -draw 'rectangle 1091,82 1279,229' \
  -fill '#c4c4c4' -draw 'ellipse 246,109 95,45 0,360' -draw 'ellipse 1665,103 95,45 0,360' /tmp/dr_break.png
stamp /tmp/dr_break.png break-room/Break_Room_couch_2048.webp '#565656' '#7e7e7e' /tmp/dr_break.png
stamp /tmp/dr_break.png break-room/Break_Room_table_2048.webp '#8a8a8a' '#b3b3b3' /tmp/dr_break.png
magick /tmp/dr_break.png -blur $BLUR break-room/depth/depth.png

# ---- signal-cartography ----------------------------------------------------
mkdir -p signal-cartography/depth
magick signal-cartography/cart_room_empty_2048.webp signal-cartography/cart_room_radar_2048.webp -composite \
  signal-cartography/cart_room_file_cab_2048.webp -composite \
  signal-cartography/cart_room_desk_2048.webp -composite signal-cartography/depth/stable.png
magick signal-cartography/cart_room_decay_2048.webp signal-cartography/cart_room_radar_2048.webp -composite \
  signal-cartography/cart_room_file_cab_2048.webp -composite \
  signal-cartography/cart_room_desk_2048.webp -composite signal-cartography/depth/decayed.png
build_box 513 1488 103 667 /tmp/dr_cart.png
magick /tmp/dr_cart.png \
  -fill '#c4c4c4' -draw 'ellipse 280,120 95,45 0,360' -draw 'ellipse 1740,115 95,45 0,360' /tmp/dr_cart.png
stamp /tmp/dr_cart.png signal-cartography/cart_room_radar_2048.webp '#606060' '#787878' /tmp/dr_cart.png
stamp /tmp/dr_cart.png signal-cartography/cart_room_file_cab_2048.webp '#6a6a6a' '#7e7e7e' /tmp/dr_cart.png
stamp /tmp/dr_cart.png signal-cartography/cart_room_desk_2048.webp '#8a8a8a' '#b8b8b8' /tmp/dr_cart.png
magick /tmp/dr_cart.png -blur $BLUR signal-cartography/depth/depth.png

# ---- lamp glow layers (flattened to black for shader screen-blend) ---------
magick observation/Light_glow_2048.webp -background black -flatten -quality 85 observation/depth/glow.jpg
magick break-room/Break_Room_light_glow_2048.webp -background black -flatten -quality 85 break-room/depth/glow.jpg
magick signal-cartography/cart_room_lights_1_2048.webp -background black -flatten \
  \( signal-cartography/cart_room_lights_2_2048.webp -background black -flatten \) \
  -compose screen -composite -quality 85 signal-cartography/depth/glow.jpg

rm -f /tmp/dr_*.png
echo "Done: observation, break-room, signal-cartography depth assets built."

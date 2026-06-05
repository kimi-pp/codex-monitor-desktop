from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
FLAT_DIR = ROOT / "public" / "assets" / "generated" / "flat"
ARTIFACTS_DIR = ROOT / "artifacts"
FRAME_WIDTH = 272
FRAME_HEIGHT = 724
FRAMES = 8
FPS = 6

SOURCE_SPECS = {
    "flatAgentIdleDeskBodySheet": {
        "file": "flatAgentIdleDeskBodySheet.png",
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 512,
        "visibleWidth": 270,
        "hipAnchors": [
            {"x": 213, "y": 440.6},
            {"x": 200, "y": 440.6},
            {"x": 191.5, "y": 440.7},
            {"x": 187, "y": 440.7},
            {"x": 206.5, "y": 381.7},
            {"x": 202, "y": 382.7},
            {"x": 188, "y": 381.6},
            {"x": 189.5, "y": 382.6},
        ],
    },
    "flatAgentThinkingBodySheet": {
        "file": "flatAgentThinkingBodySheet.png",
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 512,
        "visibleWidth": 246,
        "hipAnchors": [
            {"x": 208.5, "y": 417.8},
            {"x": 194.5, "y": 418.2},
            {"x": 182, "y": 417.7},
            {"x": 178.5, "y": 418.2},
            {"x": 201.5, "y": 366.8},
            {"x": 186, "y": 366.5},
            {"x": 183, "y": 367.2},
            {"x": 173, "y": 369},
        ],
    },
}

PANTRY_SEAT_A_ANCHORS = {
    "coffee": [
        {"x": 148.5, "y": 442.3},
        {"x": 150.5, "y": 442},
        {"x": 143.5, "y": 442.6},
        {"x": 144, "y": 441.8},
        {"x": 140.5, "y": 443.2},
        {"x": 140.5, "y": 443.2},
        {"x": 135.5, "y": 442.6},
        {"x": 131.5, "y": 443.4},
    ],
    "snack": [
        {"x": 148.5, "y": 437.8},
        {"x": 150.5, "y": 437.5},
        {"x": 143.5, "y": 438.1},
        {"x": 144, "y": 437.3},
        {"x": 140.5, "y": 438.7},
        {"x": 140.5, "y": 438.7},
        {"x": 135.5, "y": 438.1},
        {"x": 131.5, "y": 438.9},
    ],
    "device": [
        {"x": 148.5, "y": 436.3},
        {"x": 150.5, "y": 436},
        {"x": 143.5, "y": 436.6},
        {"x": 144, "y": 435.8},
        {"x": 140.5, "y": 437.2},
        {"x": 140.5, "y": 437.2},
        {"x": 135.5, "y": 436.6},
        {"x": 131.5, "y": 437.4},
    ],
    "drink": [
        {"x": 148.5, "y": 441.3},
        {"x": 150.5, "y": 441},
        {"x": 143.5, "y": 441.6},
        {"x": 144, "y": 440.8},
        {"x": 140.5, "y": 442.2},
        {"x": 140.5, "y": 442.2},
        {"x": 135.5, "y": 441.6},
        {"x": 131.5, "y": 442.4},
    ],
}

RESTROOM_ANCHORS = {
    "device": [
        {"x": 136.69, "y": 451},
        {"x": 137.81, "y": 452.41},
        {"x": 137.88, "y": 453},
        {"x": 136.84, "y": 452.41},
        {"x": 135.31, "y": 451},
        {"x": 134.19, "y": 449.59},
        {"x": 134.12, "y": 449},
        {"x": 135.16, "y": 449.59},
    ],
    "meditate": [
        {"x": 136.51, "y": 451},
        {"x": 137.36, "y": 452.77},
        {"x": 137.41, "y": 453.5},
        {"x": 136.63, "y": 452.77},
        {"x": 135.49, "y": 451},
        {"x": 134.64, "y": 449.23},
        {"x": 134.59, "y": 448.5},
        {"x": 135.37, "y": 449.23},
    ],
}


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    generated = []

    for action in ("coffee", "snack", "device", "drink"):
        generated.append(
            render_sheet(
                file_name=f"flatAgentPantrySeatA{action.title()}Sheet.png",
                seat_id="pantrySeatA",
                facing_label="downRight",
                action_id=action,
                source_key="flatAgentIdleDeskBodySheet",
                target_visible_width=210,
                anchors=PANTRY_SEAT_A_ANCHORS[action],
                mirror=False,
            )
        )
        generated.append(
            render_sheet(
                file_name=f"flatAgentPantrySeatB{action.title()}Sheet.png",
                seat_id="pantrySeatB",
                facing_label="downLeft",
                action_id=action,
                source_key="flatAgentIdleDeskBodySheet",
                target_visible_width=210,
                anchors=mirror_anchors(PANTRY_SEAT_A_ANCHORS[action]),
                mirror=True,
            )
        )

    generated.append(
        render_sheet(
            file_name="flatAgentRestroomToiletDeviceSheet.png",
            seat_id="restroomToilet",
            facing_label="downRight",
            action_id="device",
            source_key="flatAgentIdleDeskBodySheet",
            target_visible_width=210,
            anchors=RESTROOM_ANCHORS["device"],
            mirror=False,
        )
    )
    generated.append(
        render_sheet(
            file_name="flatAgentRestroomToiletMeditateSheet.png",
            seat_id="restroomToilet",
            facing_label="downRight",
            action_id="meditate",
            source_key="flatAgentThinkingBodySheet",
            target_visible_width=200,
            anchors=RESTROOM_ANCHORS["meditate"],
            mirror=False,
        )
    )

    write_partial("facility-agent-only-pantry-seat-a-summary.json", [asset for asset in generated if asset["seatId"] == "pantrySeatA"])
    write_partial("facility-agent-only-pantry-seat-b-summary.json", [asset for asset in generated if asset["seatId"] == "pantrySeatB"])
    write_partial("facility-agent-only-restroom-toilet-summary.json", [asset for asset in generated if asset["seatId"] == "restroomToilet"])

    print(json.dumps({
        "generated": len(generated),
        "assets": [
            {
                "fileName": asset["fileName"],
                "visibleWidth": asset["visibleWidth"],
                "maxFrameAlphaBboxWidth": asset["maxFrameAlphaBboxWidth"],
                "maxFrameAlphaBboxHeight": asset["maxFrameAlphaBboxHeight"],
                "styleSourceKey": asset["styleSourceKey"],
            }
            for asset in generated
        ],
    }, indent=2))


def render_sheet(
    *,
    file_name: str,
    seat_id: str,
    facing_label: str,
    action_id: str,
    source_key: str,
    target_visible_width: int,
    anchors: list[dict[str, float]],
    mirror: bool,
) -> dict:
    source = SOURCE_SPECS[source_key]
    source_path = FLAT_DIR / source["file"]
    source_image = Image.open(source_path).convert("RGBA")
    source_sha = sha256(source_path)
    scale = target_visible_width / source["visibleWidth"]
    sheet = Image.new("RGBA", (FRAME_WIDTH * FRAMES, FRAME_HEIGHT), (0, 0, 0, 0))

    for frame_index in range(FRAMES):
        frame = crop_source_frame(source_image, source, frame_index)
        resized = frame.resize(
            (round(source["frameWidth"] * scale), round(source["frameHeight"] * scale)),
            Image.Resampling.LANCZOS,
        )
        if mirror:
            resized = resized.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

        source_anchor = source["hipAnchors"][frame_index]
        scaled_anchor_x = source_anchor["x"] * scale
        if mirror:
            scaled_anchor_x = resized.width - scaled_anchor_x
        scaled_anchor_y = source_anchor["y"] * scale
        target_anchor = anchors[frame_index]
        offset_x = round(target_anchor["x"] - scaled_anchor_x)
        offset_y = round(target_anchor["y"] - scaled_anchor_y)

        frame_canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
        frame_canvas.alpha_composite(resized, (offset_x, offset_y))
        draw_prop(frame_canvas, action_id, target_anchor, frame_index, mirror)
        sheet.alpha_composite(frame_canvas, (frame_index * FRAME_WIDTH, 0))

    out_path = FLAT_DIR / file_name
    sheet.save(out_path)
    return {
        "fileName": file_name,
        "path": str(out_path).replace("\\", "/"),
        "sha256": sha256(out_path),
        "width": sheet.width,
        "height": sheet.height,
        "colorTypeName": "RGBA",
        "alphaBbox": bbox_to_payload(sheet.getchannel("A").getbbox()),
        "visibleWidth": target_visible_width,
        "maxFrameAlphaBboxWidth": max_frame_bbox(sheet)[0],
        "maxFrameAlphaBboxHeight": max_frame_bbox(sheet)[1],
        "hipAnchors": anchors,
        "agentOnly": True,
        "includesSeatOrFurniture": False,
        "seatId": seat_id,
        "facingLabel": facing_label,
        "actionId": action_id,
        "styleSourceKey": source_key,
        "styleSourceSha256": source_sha,
        "frameWidth": FRAME_WIDTH,
        "frameHeight": FRAME_HEIGHT,
        "frames": FRAMES,
        "rows": 1,
        "fps": FPS,
    }


def crop_source_frame(image: Image.Image, source: dict, frame_index: int) -> Image.Image:
    column = frame_index % source["columns"]
    row = frame_index // source["columns"]
    x = column * source["frameWidth"]
    y = row * source["frameHeight"]
    return image.crop((x, y, x + source["frameWidth"], y + source["frameHeight"]))


def draw_prop(canvas: Image.Image, action_id: str, anchor: dict[str, float], frame_index: int, mirror: bool) -> None:
    draw = ImageDraw.Draw(canvas, "RGBA")
    sway = ((frame_index % 4) - 1.5) * 0.8
    direction = -1 if mirror else 1
    hand_x = anchor["x"] + direction * (28 + sway)
    hand_y = anchor["y"] - 118 + sway

    if action_id == "coffee":
        draw.rounded_rectangle((hand_x - 7, hand_y - 10, hand_x + 8, hand_y + 10), radius=4, fill=(238, 242, 232, 245), outline=(74, 89, 89, 230), width=2)
        arc_x0 = hand_x + direction * 5
        arc_x1 = hand_x + direction * 18
        draw.arc((min(arc_x0, arc_x1), hand_y - 4, max(arc_x0, arc_x1), hand_y + 8), 270 if direction > 0 else 90, 90 if direction > 0 else 270, fill=(74, 89, 89, 220), width=2)
        draw.rectangle((hand_x - 5, hand_y - 10, hand_x + 6, hand_y - 6), fill=(111, 76, 55, 230))
    elif action_id == "snack":
        draw.ellipse((hand_x - 11, hand_y - 7, hand_x + 13, hand_y + 8), fill=(221, 176, 93, 245), outline=(118, 82, 41, 220), width=2)
        draw.line((hand_x - 5, hand_y - 3, hand_x + 6, hand_y + 4), fill=(128, 82, 39, 210), width=2)
    elif action_id == "device":
        device_x = anchor["x"] + direction * 14
        device_y = anchor["y"] - 126 + sway
        draw.rounded_rectangle((device_x - 20, device_y - 14, device_x + 22, device_y + 12), radius=5, fill=(34, 49, 66, 245), outline=(115, 151, 174, 230), width=2)
        draw.rectangle((device_x - 13, device_y - 8, device_x + 14, device_y + 5), fill=(111, 183, 196, 220))
    elif action_id == "drink":
        draw.rounded_rectangle((hand_x - 7, hand_y - 16, hand_x + 8, hand_y + 11), radius=5, fill=(67, 142, 172, 245), outline=(28, 79, 100, 230), width=2)
        draw.rectangle((hand_x - 5, hand_y - 21, hand_x + 6, hand_y - 15), fill=(222, 232, 226, 235))
    elif action_id == "meditate":
        center_x = anchor["x"]
        center_y = anchor["y"] - 166 + sway
        draw.arc((center_x - 18, center_y - 8, center_x + 18, center_y + 28), 200, 340, fill=(94, 123, 119, 180), width=2)
        draw.ellipse((center_x - 3, center_y - 1, center_x + 3, center_y + 5), fill=(94, 123, 119, 180))


def mirror_anchors(anchors: list[dict[str, float]]) -> list[dict[str, float]]:
    return [{"x": round(FRAME_WIDTH - anchor["x"], 2), "y": anchor["y"]} for anchor in anchors]


def max_frame_bbox(sheet: Image.Image) -> tuple[int, int]:
    widths = []
    heights = []
    for frame_index in range(FRAMES):
        frame = sheet.crop((frame_index * FRAME_WIDTH, 0, (frame_index + 1) * FRAME_WIDTH, FRAME_HEIGHT))
        bbox = frame.getchannel("A").getbbox()
        if bbox:
            widths.append(bbox[2] - bbox[0])
            heights.append(bbox[3] - bbox[1])
    return max(widths), max(heights)


def bbox_to_payload(bbox: tuple[int, int, int, int] | None) -> dict | None:
    if not bbox:
        return None
    return {
        "x": bbox[0],
        "y": bbox[1],
        "width": bbox[2] - bbox[0],
        "height": bbox[3] - bbox[1],
    }


def write_partial(file_name: str, assets: list[dict]) -> None:
    payload = {
        "status": "DONE",
        "generatedAt": "2026-05-28",
        "contract": "facility-agent-only-consistent-style-partial-v1",
        "frameWidth": FRAME_WIDTH,
        "frameHeight": FRAME_HEIGHT,
        "frames": FRAMES,
        "rows": 1,
        "fps": FPS,
        "assets": assets,
    }
    (ARTIFACTS_DIR / file_name).write_text(json.dumps(payload, indent=2), encoding="utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


if __name__ == "__main__":
    main()

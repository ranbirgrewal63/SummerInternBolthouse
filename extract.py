import cv2
import os
from pathlib import Path

video_folder = "yellow carrots"       # folder containing your videos
output_folder = "yellow_frames"

os.makedirs(output_folder, exist_ok=True)

frame_interval = 60  # save every 60 frames

video_extensions = [".mp4", ".avi", ".mov", ".mkv"]

saved_count = 0

for video_file in Path(video_folder).iterdir():

    if video_file.suffix.lower() not in video_extensions:
        continue

    print(f"Processing: {video_file.name}")

    cap = cv2.VideoCapture(str(video_file))

    frame_count = 0

    while True:
        ret, frame = cap.read()

        if not ret:
            break

        if frame_count % frame_interval == 0:
            filename = os.path.join(
                output_folder,
                f"{video_file.stem}_frame_{saved_count}.jpg"
            )

            cv2.imwrite(filename, frame)
            saved_count += 1

        frame_count += 1

    cap.release()

print(f"Finished. Total frames saved: {saved_count}")
import cv2
import os

video_path = r'C:\Users\grewalr\Desktop\SummerInternBolthouse\carrot_videos\MicrosoftTeams-video (4).mp4'

os.makedirs('frames_incline', exist_ok=True)
cap = cv2.VideoCapture(video_path)
count = 0
saved = 0
while True:
    ret, frame = cap.read()
    if not ret:
        break
    if count % 3 == 0:  # every 3rd frame
        cv2.imwrite(f'frames_incline/frame_{saved}.jpg', frame)
        saved += 1
    count += 1
cap.release()
print(f'Saved {saved} frames total')
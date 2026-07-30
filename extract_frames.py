import cv2
import os

videos = [
    r'C:\Users\grewalr\Desktop\SummerInternBolthouse\carrot_videos\20260708_225008000_iOS.MOV',
    r'C:\Users\grewalr\Desktop\SummerInternBolthouse\carrot_videos\20260708_225228000_iOS.MOV'
    r"C:\Users\grewalr\Desktop\SummerInternBolthouse\carrot_videos\20260106_101605.mp4"
]

os.makedirs('frames', exist_ok=True)
saved = 0
for v in videos:
    cap = cv2.VideoCapture(v)
    count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if count % 15 == 0:
            cv2.imwrite(f'frames/frame_{saved}.jpg', frame)
            saved += 1
        count += 1
    cap.release()

print(f'Saved {saved} frames total')
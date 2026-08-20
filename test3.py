
import cv2
for i in range(4):
    cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
    if cap.isOpened():
        ret, frame = cap.read()
        print(f'Camera {i}: opened={cap.isOpened()}, got_frame={ret}')
        cap.release()
    else:
        print(f'Camera {i}: not found')
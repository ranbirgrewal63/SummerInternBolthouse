import cv2
from ultralytics import YOLO

model = YOLO('weights2/best.pt')
cap = cv2.VideoCapture(1)

while True:
    ret, frame = cap.read()
    if not ret:
        break
    results = model(frame, conf=0.3)
    annotated = results[0].plot()
    cv2.imshow('test', annotated)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
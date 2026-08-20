import cv2

cap = cv2.VideoCapture("http://192.168.1.48:8080/videofeed")

print("Opened:", cap.isOpened())

while True:
    ret, frame = cap.read()

    if not ret:
        print("Lost frame")
        break

    cv2.imshow("Camera", frame)

    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()
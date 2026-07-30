import cv2

url = "rtsp://192.168.1.48:8080/h264_ulaw.sdp"

cap = cv2.VideoCapture(url)

while True:
    ret, frame = cap.read()

    if not ret:
        print("Lost stream")
        break

    cv2.imshow("RTSP Camera", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
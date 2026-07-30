import sqlite3

con = sqlite3.connect("eventData.db")
c=con.cursor()
c.execute("CREATE TABLE events(eventId, timestamp, cameraID, snapshot, model, payload)")
con.commit()

#from backend.database import initialize_database

#if __name__ == "__main__":
#    initialize_database()
#    print("Database initialized.")
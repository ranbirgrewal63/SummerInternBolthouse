import sqlite3

con = sqlite3.connect('eventData.db')
c = con.cursor()

query = """SELECT * FROM events"""
c.execute(query)

print("All data from events.db")

data = c.fetchall()
for row in data:
    print(row)
con.commit()
con.close()

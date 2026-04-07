import asyncio
from datetime import timedelta
from winsdk.windows.devices.geolocation import Geolocator

async def test():
    try:
        g = Geolocator()
        g.desired_accuracy = 1  # PositionAccuracy.High
        g.report_interval = 1000
        
        print("Requesting actual position...")
        pos = await g.get_geoposition_async(timedelta(seconds=0), timedelta(seconds=10))
        print("Pos:", pos.coordinate.latitude, pos.coordinate.longitude)
    except Exception as e:
        print("Error:", e)

asyncio.run(test())

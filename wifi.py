import sys
import json
import argparse

import requests

import logging

# Configure built-in logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Standard Open GoPro local HTTP base URL
GOPRO_BASE_URL = "http://10.5.5.9:8080"


def main() -> None:
    # Build the HTTP GET request
    url = GOPRO_BASE_URL + "/gopro/camera/stream/stop"
    logger.info(f"Stopping the preview stream: sending {url}")

    # Send the GET request and retrieve the response
    response = requests.get(url, timeout=10)
    # Check for errors (if an error is found, an exception will be raised)
    response.raise_for_status()
    logger.info("Command sent successfully")
    # Log response as json
    logger.info(f"Response: {json.dumps(response.json(), indent=4)}")

    # Build the HTTP GET request
    url = GOPRO_BASE_URL + "/gopro/camera/stream/start"
    logger.info(f"Starting the preview stream: sending {url}")

    # Send the GET request and retrieve the response
    response = requests.get(url, timeout=10)
    # Check for errors (if an error is found, an exception will be raised)
    response.raise_for_status()
    logger.info("Command sent successfully")
    # Log response as json
    logger.info(f"Response: {json.dumps(response.json(), indent=4)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enable the preview stream.")
    parser.parse_args()

    try:
        main()
    except Exception as e:  # pylint: disable=broad-exception-caught
        logger.error(e)
        sys.exit(-1)
    else:
        sys.exit(0)
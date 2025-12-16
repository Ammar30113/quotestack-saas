#!/usr/bin/env python3
import requests
import logging


def fetch_random_quote():
    """
    Fetch a random quote from a public quotes API and return the JSON response.
    """
    url = "https://api.quotable.io/random"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def main():
    try:
        data = fetch_random_quote()
        logging.basicConfig(level=logging.INFO)
        logging.info("Received response from API: %s", data)
        print(data)
    except requests.exceptions.RequestException as e:
        logging.error("API request failed: %s", e)


if __name__ == "__main__":
    main()

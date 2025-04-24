# Python 3.11.1
# 2024-03-07

## Imports  ##
import json
import http
import requests

requests.packages.urllib3.disable_warnings()
import xmltodict
import asyncio
import aiohttp
from xml.dom import minidom
import os
import time
import logging
import warnings  # Erro falso positivo

warnings.filterwarnings("ignore", category=DeprecationWarning)
from PIL import Image
import re


def findWholeWord(w):
    return re.compile(r"\b({0})\b".format(w), flags=re.IGNORECASE).search


## Functions ##

# Setup logging basic conf
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
    filename="feed.log",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def getBlockedWords(url):
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
    else:
        logging.error("Failed to get blocked words from {}".format(url))
        data = {}
    return data


def getxml():
    conn = http.client.HTTPSConnection("br.investing.com")

    payload = ""
    headers = {}
    conn.request("GET", "/rss/news_287.rss", payload, headers)
    res = conn.getresponse()
    if res.status == 200:
        data = res.read()
        data = xmltodict.parse(data)
        # Log success
        logging.info(
            "Success on getting xml from {}".format(
                "https://br.investing.com/rss/news_287.rss"
            )
        )
    else:
        # Log error
        logging.error(
            "Failed to get xml from {}".format(
                "https://br.investing.com/rss/news_287.rss"
            )
        )
        data = {}
    return data


# Global variables #
global nowtime
nowtime = time.time()
global imagesToDownload
imagesToDownload = []


## Transform downloadImages and buildXML into one async function ##
def main():
    # Check if ./images/ folder exists
    if not os.path.exists("./images/"):
        os.makedirs("./images/")
    global imagesToDownload, nowtime
    data = getxml()
    doc = minidom.Document()
    rss = doc.createElement("rss")
    rss.setAttribute("version", "2.0")
    doc.appendChild(rss)
    updtime = doc.createElement("time")
    rss.appendChild(updtime)
    # Log start time
    now = time.ctime(nowtime)
    logging.info("Start time main: {}".format(now))
    updtime.appendChild(doc.createTextNode(now))
    channel = doc.createElement("channel")
    rss.appendChild(channel)
    indexXml = 0
    for item in data.get("rss", {}).get("channel", {}).get("item", []):
        if indexXml > 10:
            break
        # Get blocked words #
        blocked_words = getBlockedWords(
            "https://combosmart.com/rsspanel/users_data/Kanjiko.json"
        )
        blocked_words = blocked_words.get("default_words", [])
        addItem = True
        for word in blocked_words:
            if "title" in item and findWholeWord(word)(item["title"]):
                print("Blocked word found in title: {}".format(word))
                addItem = False
            if "description" in item and findWholeWord(word)(item["description"]):
                print("Blocked word found in description: {}".format(word))
                addItem = False
        if addItem:
            # Title #
            title = doc.createElement("title")
            title.appendChild(doc.createTextNode("Geral"))
            logTitle = "Geral"
            # Description #
            description = doc.createElement("description")
            description.appendChild(doc.createTextNode(item.get("title", "")))
            logDescription = item.get("title", "")
            # Path #
            ## Image path = ../images/index.ext ##
            if "enclosure" not in item:
                filename = "./assets/placeholder.png"
                logImage = filename
            else:
                # Get image tag
                url = item["enclosure"]["@url"]
                logImage = url
                imagesToDownload.append(url)
                # Get extension
                ext = url.split(".")[-1]
                # Create folder images if not exists
                if not os.path.exists("./images/"):
                    os.makedirs("./images/")
                # Set filename index and ext
                filename = f"./images/{indexXml}.{ext}"
            path = doc.createElement("linkfoto")
            path.appendChild(doc.createTextNode(filename))
            # Close item #
            itemElem = doc.createElement("item")
            itemElem.appendChild(title)
            itemElem.appendChild(description)
            itemElem.appendChild(path)
            channel.appendChild(itemElem)
            indexXml += 1
            # Log title, description and image #
            logging.info(
                "Title: {} | Description: {} | Image: {}".format(
                    logTitle, logDescription, logImage
                )
            )
    # Save feed.xml UTF8 #
    with open("feed.xml", "w", encoding="utf-8") as f:
        f.write(doc.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8"))
        # Log done time
        now = time.ctime(time.time())
        logging.info("Done time main: {}".format(now))


async def downloader():
    global imagesToDownload
    logging.info("Start time downloader: {}".format(time.ctime(time.time())))
    async with aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(ssl=False)
    ) as session:
        for index, url in enumerate(imagesToDownload):
            # Get extension
            ext = url.split(".")[-1]
            # Split ? on ext
            ext = ext.split("?")[0]
            # Set filename index and ext
            filename = f"./images/{index}.{ext}"
            # Download image
            async with session.get(url) as response:
                content = await response.read()
                with open(filename, "wb") as f:
                    f.write(content)
                    # If filesize is > 1MB, compress image with PIL
                    if os.path.getsize(filename) > 1000000:
                        img = Image.open(filename)
                        img.save(filename, quality=20)
                    # Log done download #
                    logging.info("Downloaded {} from {}".format(filename, url))
    # Log done time
    logging.info("Done time downloader: {}".format(time.ctime(time.time())))


if __name__ == "__main__":
    main()
    asyncio.run(downloader())

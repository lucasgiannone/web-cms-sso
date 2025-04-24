# Python 3.11.1
# 2024-03-07

## Imports  ##
import json
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


def getBlockedWords(url):
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()

    else:

        logging.error("Failed to get blocked words from {}".format(url))
    return data


## Functions ##


# Setup logging basic conf
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
    filename="feed.log",
    datefmt="%Y-%m-%d %H:%M:%S",
)


# Get xml from url
def getxml(url):
    ua = "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.9.0.7) Gecko/2009021910 Firefox/3.0.7"
    response = requests.get(url, headers={"User-Agent": ua}, verify=False)
    if response.status_code == 200:
        data = xmltodict.parse(response.content)
        # Log success
        logging.info("Success on getting xml from {}".format(url))
    else:
        # Log error
        logging.error("Failed to get xml from {}".format(url))
    return data


## Transform downloadImages and buildXML into one async function ##
def main(url):
    # Check if ./images/ folder exists
    if not os.path.exists("./images/"):
        os.makedirs("./images/")
    global imagesToDownload, now, indexXml, doc, channel, publisher
    data = getxml(url)
    logging.info("Start time main: {}".format(now))
    for item in data["rss"]["channel"]["item"]:
        # Filter item description if contains blocked words from ../../utils/blocked_words.json #
        # Get blocked words #
        with open("../../utils/blocked_words.json", "r", encoding="utf-8") as f:
            blocked_words = json.load(f)
            blocked_words = blocked_words["default_words"]
        addItem = True
        blocked_words = getBlockedWords(
            "https://combosmart.com/rsspanel/users_data/Kanjiko.json"
        )
        blocked_words = blocked_words["default_words"]
        addItem = True
        for word in blocked_words:
            if findWholeWord(word)(item["title"]):
                print("Blocked word found: {}".format(word))
                # Log blocked word
                logDescription = item["title"]
                logging.info("Blocked word found: {} | {}".format(word, logDescription))
                addItem = False
            # if findWholeWord(word)(item['description']):
            #     print('Blocked word found: {}'.format(word))
            #     addItem = False

        # If description len is < 50
        if len(item["description"]) < 50:
            logDescription = item["title"]
            description_text = item["description"]
            print("Description len < 50: " + description_text)
            # Log description len < 50
            logging.info(
                "Description len < 50: {} | {}".format(description_text, logDescription)
            )
            addItem = False

        # If item['pubDate'] is not in the last 72 hours
        pubDate = item["pubDate"]
        # Format {Thu, 14 Mar 2024 21:26:11 -0000} to {yyyy-mm-dd}
        pubDate = time.strptime(pubDate, "%a, %d %b %Y %H:%M:%S %z")
        pubDate = time.mktime(pubDate)
        now = time.time()
        seconds = 60 * 60 * 24 * 7
        if now - pubDate > seconds:
            logDescription = item["title"]
            # Log pubDate > 72 hours
            logging.info("pubDate > 72 hours: {} | {}".format(pubDate, logDescription))
            addItem = False

        # If news already in doc minidom, skip
        for i in range(len(channel.childNodes)):
            if (
                item["title"]
                == channel.childNodes[i].childNodes[1].firstChild.nodeValue
            ):
                logDescription = item["title"]
                # Log news already in doc
                logging.info("News already in doc: {}".format(logDescription))
                addItem = False

        if addItem != False:
            # Title#
            title = doc.createElement("title")
            title.appendChild(doc.createTextNode(publisher))
            logTitle = publisher
            # Description #
            description = doc.createElement("description")
            description.appendChild(doc.createTextNode(item["title"]))
            logDescription = item["title"]
            # pubDate #
            pubDate = doc.createElement("pubDate")
            pubDate.appendChild(doc.createTextNode(item["pubDate"]))
            # Path #
            ## Image path = ./images/index.ext ##
            # If media:content exists
            if "media:content" not in item:
                continue
            else:
                # Get media:content url #
                url = item["media:content"]["@url"]
                # print(url)
                # Get extension
                ext = url.split(".")[-1]
                # Split ? on ext
                ext = ext.split("?")[0]
                if ext == "jpg":
                    logImage = url
                    imagesToDownload.append(url)
                    # Create folder images if not exists
                    if not os.path.exists("./images/"):
                        os.makedirs("./images/")
                    # Set filename index and ext
                    filename = f"./images/{indexXml}.{ext}"
                    path = doc.createElement("linkfoto")
                    path.appendChild(doc.createTextNode(filename))
                    # Close item #
                    item = doc.createElement("item")
                    item.appendChild(title)
                    item.appendChild(description)
                    item.appendChild(path)
                    item.appendChild(pubDate)
                    channel.appendChild(item)
                    indexXml += 1
                    # Log title, description and image #
                    logging.info(
                        "Title: {} | Description: {} | Image: {}".format(
                            logTitle, logDescription, logImage
                        )
                    )
    # # Save feed.xml UTF8 #
    # with open('feed.xml', 'w', encoding='utf-8') as f:
    #     f.write(doc.toprettyxml(indent='  ', encoding='utf-8').decode('utf-8'))
    #     # Log done time
    #     now = time.ctime(time.time())
    #     logging.info('Done time main: {}'.format(now))
    #     # Print done time
    #     # print(now)


async def downloader():
    global imagesToDownload
    logging.info("Start time downloader: {}".format(time.ctime(time.time())))
    async with aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(verify_ssl=False)
    ) as session:
        for index, url in enumerate(imagesToDownload):
            # Get extension
            ext = url.split(".")[-1]
            # Split ? on ext
            ext = ext.split("?")[0]
            if ext == "jpg":
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
                            img.save(filename, quality=50)
                        # Log done download #
                        logging.info("Downloaded {} from {}".format(filename, url))
    # Log done time
    logging.info("Done time downloader: {}".format(time.ctime(time.time())))


if __name__ == "__main__":
    # Global variables #
    nowtime = time.time()
    imagesToDownload = []
    indexXml = 0
    doc = minidom.Document()
    rss = doc.createElement("rss")
    rss.setAttribute("version", "2.0")
    doc.appendChild(rss)
    updtime = doc.createElement("time")
    rss.appendChild(updtime)
    now = time.ctime(nowtime)
    updtime.appendChild(doc.createTextNode(now))
    channel = doc.createElement("channel")
    rss.appendChild(channel)
    publisher = "Agronegócios"
    main("https://pox.globo.com/rss/g1/economia/agronegocios/")
    publisher = "Economia"
    main("https://pox.globo.com/rss/g1/economia/")
    # Save feed.xml UTF8 #
    with open("feed.xml", "w", encoding="utf-8") as f:
        f.write(doc.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8"))
        # Log done time
        now = time.ctime(time.time())
        logging.info("Done time main: {}".format(now))
    asyncio.run(downloader())

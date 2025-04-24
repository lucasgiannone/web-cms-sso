import requests
import xmltodict
from xml.dom import minidom
import os
import logging
import re

# Setup logging basic conf
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
    filename="feed.log",
    datefmt="%Y-%m-%d %H:%M:%S",
)


# Função para baixar e analisar o XML
def getxml():
    url = "http://cruzeirofm.com.br/feed"
    ua = "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.9.0.7) Gecko/2009021910 Firefox/3.0.7"
    response = requests.get(url, headers={"User-Agent": ua}, verify=False)
    if response.status_code == 200:
        data = xmltodict.parse(response.content)
        logging.info("Success on getting xml from {}".format(url))
    else:
        logging.error("Failed to get xml from {}".format(url))
        return None
    return data


# Função para remover tags HTML e limitar o texto
def clean_and_truncate_text(text, max_length=300):
    # Remove tags HTML
    clean_text = re.sub(r"<.*?>", "", text)

    # Limitar o texto ao tamanho máximo permitido
    if len(clean_text) > max_length:
        return clean_text[:max_length].strip() + " [...]"
    return clean_text


# Função principal para construir o novo XML
def build_new_xml(data):
    doc = minidom.Document()

    # Criação do elemento <rss>
    rss = doc.createElement("rss")
    rss.setAttribute("version", "2.0")
    doc.appendChild(rss)

    # Criação do elemento <channel>
    channel = doc.createElement("channel")
    rss.appendChild(channel)

    # Adiciona os campos essenciais do canal
    title = doc.createElement("title")
    title.appendChild(doc.createTextNode(data["rss"]["channel"].get("title", "")))
    channel.appendChild(title)

    link = doc.createElement("link")
    link.appendChild(doc.createTextNode(data["rss"]["channel"].get("link", "")))
    channel.appendChild(link)

    description = doc.createElement("description")
    description.appendChild(
        doc.createTextNode(data["rss"]["channel"].get("description", ""))
    )
    channel.appendChild(description)

    # Loop pelos itens (notícias)
    for item in data["rss"]["channel"].get("item", []):
        item_element = doc.createElement("item")

        # Título da notícia
        item_title = doc.createElement("title")
        item_title.appendChild(doc.createTextNode(item.get("title", "")))
        item_element.appendChild(item_title)

        # Link da notícia
        item_link = doc.createElement("link")
        item_link.appendChild(doc.createTextNode(item.get("link", "")))
        item_element.appendChild(item_link)

        # Data de publicação
        pub_date = doc.createElement("pubDate")
        pub_date.appendChild(doc.createTextNode(item.get("pubDate", "")))
        item_element.appendChild(pub_date)

        # Descrição: Remove as tags HTML e limita o tamanho do texto
        raw_description = item.get("description", "")
        clean_description = clean_and_truncate_text(raw_description)

        description = doc.createElement("description")
        description.appendChild(doc.createTextNode(clean_description))
        item_element.appendChild(description)

        channel.appendChild(item_element)

    # Escreve o XML final em um arquivo
    with open("new_feed.xml", "w", encoding="utf-8") as f:
        f.write(doc.toprettyxml(indent="  "))

    logging.info("New XML file generated: new_feed.xml")


# Função principal que executa todo o processo
def main():
    data = getxml()
    if data:
        build_new_xml(data)


# Execução
if __name__ == "__main__":
    main()

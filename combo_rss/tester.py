import os
import logging

# This is a tester for running every  listed on array below

python = "Python311/python.exe"


folders = ["exame/default"]

# folders = [
#     'g1/economia',
#     'g1/agronegocios'
# ]

# folders = [
#     'conectaVerde/default',
#     'engarrafador/default',
#     'exame/default',
#     'exame/invest',
#     'g1/default',
#     'g1/globorural',
#     'g1/valoreconomico',
#     'g1/agronegocios',
#     'g1/economia',
#     'gazeta/default',
#     'gazeta/agronegocio',
#     'gazeta/economia',
#     'infomoney/default',
#     'investnews/default',
#     'moneytimes/default',
#     'moneytimes/economia',
#     'rural/default',
#     'tecmundo/default',
#     'uol/cotidiano',
#     'uol/economia',
#     'uol/esportes',
#     'uol/entretenimento',
# ]

# Get cwd
cwd = os.getcwd()
# Define python
python = f"{cwd}/{python}"
# Log start
logging.basicConfig(
    filename="feed.log", level=logging.INFO, format="%(asctime)s - %(message)s"
)

for folder in folders:
    try:
        # Print
        print(f"{python} {folder}feed.py")
        # Log folder
        logging.info(f"RUNNING {folder}")
        # Define path
        path = f"{cwd}/{folder}"
        # Change dir
        os.chdir(path)
        # Run script
        work = os.system(f"{python} feed.py")
        # Log result
        logging.info(f"RETURNS {work}")
        # Change dir
        os.chdir(cwd)
    except Exception as e:
        print(e)
        # Log error
        logging.error(f"ERROR {e}")
        pass

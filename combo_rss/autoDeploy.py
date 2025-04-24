import logging
import time
import pip

try:
    import git
except:
    pip.main(['install', 'GitPython'])
    import git

def gitPull():
    logging.basicConfig(
        filename="example.log",
        encoding="utf-8",
        level=logging.DEBUG,
        format="%(asctime)s %(message)s",
    )
    try:
        g = git.Git("https://github.com/lucasgiannone/combo_rss")
        # Fetch
        g.fetch()
        # Pull override
        pullar = g.reset("--hard", "origin/main")
        # Log
        logging.info("Info : " + pullar)
    except Exception as e:
        logging.warning("Erro : " + str(e))


def main():
    while True:
        print("Pulling...")
        gitPull()
        print("Pulling done!")
        # Wait 30 minutes
        print("Waiting 30 minutes...")
        time.sleep(600)

if __name__ == "__main__":
    main()

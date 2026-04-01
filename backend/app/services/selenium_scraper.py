import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service


class NaukriSeleniumScraper:

    def __init__(self):

        options = Options()

        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")

        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=options
        )

    def build_url(self, keyword, location):

        keyword = keyword.replace(" ", "-")
        location = location.replace(" ", "-")

        return f"https://www.naukri.com/{keyword}-jobs-in-{location}"

    def scrape(self, keywords, locations, pages):

        jobs = []

        for keyword in keywords:

            for location in locations:

                url = self.build_url(keyword, location)

                self.driver.get(url)

                time.sleep(4)

                for page in range(pages):

                    cards = self.driver.find_elements(By.CSS_SELECTOR, ".srp-jobtuple-wrapper")

                    for card in cards:

                        try:
                            title = card.find_element(By.CSS_SELECTOR, "a.title").text
                        except:
                            title = ""

                        try:
                            company = card.find_element(By.CSS_SELECTOR, "a.comp-name").text
                        except:
                            company = ""

                        try:
                            loc = card.find_element(By.CSS_SELECTOR, ".locWdth").text
                        except:
                            loc = ""

                        try:
                            exp = card.find_element(By.CSS_SELECTOR, ".expwdth").text
                        except:
                            exp = ""

                        try:
                            link = card.find_element(By.CSS_SELECTOR, "a.title").get_attribute("href")
                        except:
                            link = ""

                        jobs.append({
                            "keyword": keyword,
                            "location": location,
                            "job_title": title,
                            "company": company,
                            "experience": exp,
                            "source_url": link
                        })

                    try:
                        next_btn = self.driver.find_element(By.XPATH, "//a[text()='Next']")
                        next_btn.click()
                        time.sleep(4)
                    except:
                        break

        self.driver.quit()

        return jobs

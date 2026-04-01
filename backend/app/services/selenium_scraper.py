import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service


class NaukriSeleniumScraper:

    def __init__(self):

        chrome_options = Options()

        # REQUIRED for Render containers
        chrome_options.binary_location = "/usr/bin/chromium"

        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")

        service = Service("/usr/bin/chromedriver")

        self.driver = webdriver.Chrome(
            service=service,
            options=chrome_options
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

                    # go to next page
                    try:
                        next_btn = self.driver.find_element(By.XPATH, "//a[text()='Next']")
                        next_btn.click()
                        time.sleep(4)
                    except:
                        break

        self.driver.quit()

        return jobs

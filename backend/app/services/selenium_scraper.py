import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class NaukriSeleniumScraper:

    def __init__(self):
        chrome_options = Options()
        # Binary locations for Render Docker environment
        chrome_options.binary_location = "/usr/bin/chromium"
        
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

        service = Service("/usr/bin/chromedriver")
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 20)

    def build_url(self, keyword, location):
        keyword_url = keyword.replace(" ", "-")
        location_url = location.replace(" ", "-")
        return f"https://www.naukri.com/{keyword_url}-jobs-in-{location_url}"

    def scrape(self, keywords, locations, max_pages):
        all_jobs = []

        for keyword in keywords:
            for location in locations:
                url = self.build_url(keyword, location)
                print(f"Opening URL: {url}")
                self.driver.get(url)

                for page in range(1, max_pages + 1):
                    print(f"Scraping {keyword} in {location} - Page {page}")
                    
                    try:
                        # Ensure job cards are loaded
                        self.wait.until(EC.presence_of_element_located((By.CLASS_NAME, "srp-jobtuple-wrapper")))
                        time.sleep(2) # Brief jitter for stability
                        
                        # Find all job cards on current page
                        cards = self.driver.find_elements(By.CLASS_NAME, "srp-jobtuple-wrapper")
                        
                        for index, card in enumerate(cards, start=1):
                            # Using the indexed XPaths from your logic relative to the card
                            try:
                                # Note: We use '.' at start of XPath to search WITHIN the card element
                                title_el = card.find_element(By.XPATH, ".//a[@class='title ']")
                                title = title_el.text
                                link = title_el.get_attribute("href")
                                
                                try:
                                    company = card.find_element(By.XPATH, ".//a[@class='comp-name mw-25'] | .//a[@class='comp-name ']").text
                                except:
                                    company = "N/A"
                                    
                                try:
                                    exp = card.find_element(By.XPATH, ".//span[@class='expwdth']").text
                                except:
                                    exp = "N/A"
                                    
                                try:
                                    salary = card.find_element(By.XPATH, ".//span[@class='ni-job-tuple-icon ni-job-tuple-icon-srp-rupee sal']//span").text
                                except:
                                    salary = "Not Disclosed"

                                all_jobs.append({
                                    "Keyword": keyword,
                                    "Location": location,
                                    "Heading": title,
                                    "Sub Heading": company,
                                    "Vacancy Link": link,
                                    "Experience Needed": exp,
                                    "Salary": salary
                                })
                            except Exception as e:
                                continue

                        # Pagination: Look for "Next" button
                        if page < max_pages:
                            try:
                                # Scroll to bottom to ensure "Next" is interactable
                                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                                next_btn = self.wait.until(EC.element_to_be_clickable((By.XPATH, "//*[text()='Next']")))
                                self.driver.execute_script("arguments[0].click();", next_btn)
                                time.sleep(4)
                            except:
                                print("No more pages available.")
                                break
                    except:
                        print(f"Timed out waiting for page {page}")
                        break

        self.driver.quit()
        return all_jobs



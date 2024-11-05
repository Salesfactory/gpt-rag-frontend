import os
import stripe
from dotenv import load_dotenv

# load the environment variables from the .env file
load_dotenv()

# set stripe api keys for test and live 
STRIPE_API_KEY = os.getenv('STRIPE_API_KEY')
STRIPE_LIVE_API_KEY = os.getenv('STRIPE_LIVE_API_KEY')

"""initialize stripe to ensure successful authentication"""
# initialize with the test api key, switching to the live key can be done later
stripe.api_key = STRIPE_API_KEY

# product ids from both test and live environments
test_product_id = os.getenv('STRIPE_FINANCIAL_AGENT_TEST_ID')
live_product_id = os.getenv('STRIPE_FINANCIAL_AGENT_LIVE_ID')

# function to validate that the test and live products are accessible and match the requirements in each model
def validate_products():
    try:
        """retrieve product information for the test environment"""
        # since stripe was initialized with the test api key, no switching is done here
        test_product = stripe.Product.retrieve(test_product_id)
        
        """retrieve product information for the live environment"""
        # switch api key to live mode
        stripe.api_key = STRIPE_LIVE_API_KEY
        live_product = stripe.Product.retrieve(live_product_id)
        
        """retrieve associated prices for both test and live products"""
        # get the prices in live mode - no switching needed because api key is currently in live mode (see line 33)
        live_prices = stripe.Price.list(product = live_product_id)
        
        # switch api key to test mode and retrieve the price for test
        stripe.api_key = STRIPE_API_KEY
        test_prices = stripe.Price.list(product = test_product_id)
        
        # get the first price object, assuming that there's only one price per product
        live_price = live_prices['data'][0]
        test_price = test_prices['data'][0]
        
        # validate if both products have the same name, price, and billing model
        are_products_matching = (
            test_product['name'] == live_product['name'] and
            test_price['unit_amount'] == live_price['unit_amount'] and
            test_price['recurring']['interval'] == live_price['recurring']['interval']
        )

        # display a message to show success or failure in the validation process
        if are_products_matching:
            print("Validation successful: Test and Live products match the requirements.")
        else:
            print("Validation failed: Test and Live products are not identical.")

    # exception handling
    except Exception as e:
        print(f"Error during product validation: {e}")

# run the validation function
validate_products()

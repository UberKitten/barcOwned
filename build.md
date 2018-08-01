# Temporary instructions on how to set up environment for Python

## Standard Python3 environment prep (Ubuntu/Debian)
Run wherever, as root
- `apt install python3-pip`
- `pip3 install --upgrade pip`
- `pip3 install --upgrade virtualenv`

## Set up environment
Run from git repo
- `virtualenv -p python3 env`
- `source env/bin/activate`
- `python --version`
Should output Python 3.

## Install dependencies
- `pip install -r requirements.txt`

## Run server
If you haven't yet, enter the virtual environment:
- `source env/bin/activate`

Then start the server:
- `python main.py`

Should listen on port 8080.

## To commit new dependencies
- `pip freeze > requirements.txt`

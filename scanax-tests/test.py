import os

def ping_server():
    # The user input is taken directly from a hypothetical source
    address = "127.0.0.1; rm -rf /" 
    
    # SINK: Vulnerable to Command Injection
    print("Pinging " + address)
    os.system("ping -c 1 " + address)

ping_server()
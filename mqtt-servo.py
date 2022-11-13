import RPi.GPIO as GPIO
import paho.mqtt.client as mqtt
import time


states = ["OFF","ON"]
Servo = 1
GPIO.setmode(GPIO.BOARD) #Use Board numerotation mode
GPIO.setwarnings(False) #Disable warnings

#Use pin 12 for PWM signal
pwm_gpio = 12
frequence = 50
GPIO.setup(pwm_gpio, GPIO.OUT)
pwm = GPIO.PWM(pwm_gpio, frequence)


#Set function to calculate percent from angle
def angle_to_percent (angle) :
    if angle > 180 or angle < 0 :
        return False
    start = 4
    end = 12.5
    ratio = (end - start)/180 #Calcul ratio from angle to percent
    angle_as_percent = angle * ratio
    return start + angle_as_percent

def process_command(msg):
    if msg == "ON":
        # Init at 0
        pwm.start(angle_to_percent(0))
        time.sleep(1)
        # Go at 90
        pwm.ChangeDutyCycle(angle_to_percent(90))
        time.sleep(1)
        # Finish at 180
        pwm.ChangeDutyCycle(angle_to_percent(360))
        time.sleep(1)
        # Close GPIO & cleanup
        pwm.stop()
        GPIO.cleanup()


def on_message(client, data, message):
    print("Received: " + str(message.payload) +
          "on topic " + message.topic)
    cmd = str(message.payload)
    return process_command(cmd)


client = mqtt.Client()
client.connect('192.168.1.21', 1883, 60)
client.on_message = on_message

client.loop_start()

client.subscribe('miflora/Youssef', qos=0)

time.sleep(600000)

client.loop_stop()

client.disconnect()
"""
EvenStocks User API — Flask + MySQL
Run: python app.py (serves on port 5809)
See schema.sql for database setup.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from waitress import serve
import multiprocessing
import mysql.connector
import bcrypt
import random
import string
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
import pytz
from pytz import timezone
import requests
import json, os
import hmac
import hashlib
from dotenv import load_dotenv

# ---------- Config ----------
load_dotenv("../.env")

SENDER_EMAIL    =  os.getenv('SENDER_EMAIL')
SENDER_PASSWORD = os.getenv('SENDER_PASSWORD')

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD')

RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET')
RAZORPAY_ORDER_API  = "https://api.razorpay.com/v1/orders"


app = Flask(__name__)
CORS(app)

# -------------------------------------------------------------------
# HELPER FUNCTIONS
# -------------------------------------------------------------------

def get_db_connection():
    return mysql.connector.connect(
        host = DB_HOST,
        user = DB_USER,
        password = DB_PASSWORD,
        database = 'evenstocks_db',
    )

def now_in_india():
    tz = pytz.timezone('Asia/Kolkata')
    return datetime.now(tz)

def hash_password(plain_password: str) -> str:
    hashed = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def generate_otp(length=6) -> str:
    """Generate a random numeric OTP of given length."""
    digits = string.digits
    return ''.join(random.choice(digits) for _ in range(length))

def generate_user_token(length=16) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def send_otp_email(receiver_email, otp):
    sender_email    = SENDER_EMAIL
    sender_password = SENDER_PASSWORD   
    
    subject = "Evenstocks: Your OTP for Account Verification"

    html_content = f"""\
    <html>
    <body style="font-family:Arial, sans-serif;">
      <div style="max-width:450px; margin:40px auto; background:white; border-radius:8px; padding:22px;">
        <p style="font-size:19px;">Welcome to <b>Evenstocks</b>!</p>
        <p style="font-size:14px;">Your OTP for account verification is:</p>
        <p style="font-size:26px; background:#eef2f8; color:#224e96; display:inline-block; padding:10px 22px; border-radius:6px; font-weight:bold;">{otp}</p>
        <p style="font-size:13px;">Valid for 5 minutes. Please do not share this code.</p>
        <p style="font-size:12px; color:#888;">If you did not request this OTP, ignore this email.<br><br>
        — The Evenstocks Team</p>
      </div>
    </body>
    </html>
    """

    plain_text = f"""\
Welcome to Evenstocks!

Your OTP is: {otp}

This OTP is valid for 5 minutes. Please do not share it.

If you did not request this, you may safely ignore this email.

- The Evenstocks Team
"""

    msg = MIMEMultipart('alternative')
    msg["From"] = "EvenStocks <info@evenstocks.com>"
    msg["To"] = receiver_email
    msg["Subject"] = subject
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        # Using SSL (recommended)
        server = smtplib.SMTP_SSL("smtp.hostinger.com", 465)
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, receiver_email, msg.as_string())
        server.quit()
        print(f"OTP email sent to {receiver_email}")
    except Exception as e:
        print(f"Error sending OTP: {e}")

def send_plan_purchase_email(receiver_email, user_name, plan_name, order_id):
    subject = f"Congratulations! Your Evenstocks {plan_name.capitalize()} Plan is Activated 🎉"
    email_html = f"""
    <html><body>
      <div style="font-family:Arial,sans-serif;background:#f7fafc;padding:40px 10px;">
        <div style="background:#fff;border-radius:10px;padding:30px;max-width:500px;margin:auto;border:1px solid #eee;">
          <h2 style="color:#25a720;text-align:center;margin-bottom:14px;">Welcome to Premium!</h2>
          <p>Dear <b>{user_name}</b>,<br><br>
          <span style="color:#227; font-size: 16px;">Thank you for subscribing to our <b>{plan_name.capitalize()}</b> plan.<br>
          Order ID: <b style='color:#3a7'>{order_id}</b></span></p>
          <div style="margin:18px 0 12px">
            <span style="display:inline-block;padding:6px 20px;background:#1f6bff;color:white;border-radius:8px;font-size:17px;letter-spacing:2px;">
            PLAN: {plan_name.upper()}
            </span>
          </div>
          <ul style="color:#257;font-size:15px;list-style:none;padding:8px 0;">
            <li>✔️ Enjoy full premium access</li>
            <li>✔️ Increased request quota</li>
            <li>✔️ Priority support and updates</li>
            <li>– Details always available in your profile 🚀</li>
          </ul>
          <p style="font-size:12px;color:#888;">With gratitude,<br/>The Evenstocks Team</p>
        </div>
      </div>
    </body></html>
    """
    msg = MIMEMultipart('alternative')
    msg['From'] = "Evenstocks <info@evenstocks.com>"
    msg['To'] = receiver_email
    msg['Subject'] = subject
    msg.attach(MIMEText(email_html, "html"))
    try:
        server = smtplib.SMTP_SSL("smtp.hostinger.com", 465)
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, receiver_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"Mail error: {str(e)}")

def send_request_alert_email(receiver_email, user_name, remaining):
    subj = f"Only {remaining} requests left on Evenstocks" if remaining > 0 else "Your Evenstocks quota is now 0!"
    if remaining > 0:
        content = f"""<html><body>
        <div style="padding:40px 0;background:#fff;font-family:sans-serif;">
        <div style="background:#ffe5e5;padding:25px;border-radius:8px;max-width:410px;margin:auto;">
        <h3 style="color:#d83;">Hi {user_name},</h3>
        <p><b>Heads up!</b> You now have only <strong style="color:#a21;">{remaining} API / tool requests</strong> left in your subscription.</p>
        <p>Renew/upgrade to continue enjoying premium access.</p>
        <p style="font-size:12px;color:#999">- Evenstocks Team</p></div></div></body></html>"""
    else:
        content = f"""<html><body>
        <div style="padding:40px 0;background:#fff;font-family:sans-serif;">
        <div style="background:#fde2ed;padding:25px;border-radius:8px;max-width:420px;margin:auto;">
        <h3 style="color:#933;">Hi {user_name},</h3>
        <p><b>Alert!</b> Your request quota is now <strong style="color:#d00;">zero</strong>.</p>
        <p>To continue, please purchase or renew your subscription.</p>
        <p style="font-size:12px;color:#999">- Evenstocks Team</p></div></div></body></html>"""
    msg = MIMEMultipart('alternative')
    msg['From'] = "Evenstocks <info@evenstocks.com>"
    msg['To'] = receiver_email
    msg['Subject'] = subj
    msg.attach(MIMEText(content, "html"))
    try:
        server = smtplib.SMTP_SSL("smtp.hostinger.com", 465)
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, receiver_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"Mail error: {str(e)}")

def create_razorpay_order(user_name, amount_in_rupees, plan_type, currency='INR', receipt='order_rcptid_11'):
    amount_in_paise = int(amount_in_rupees * 100)
    order_data = {
        'amount': amount_in_paise,
        'currency': currency,
        'receipt': receipt,
        'payment_capture': 1,
        "notes": {
          "name": user_name,
          "Plan_type": plan_type}
    }
    response = requests.post(
        RAZORPAY_ORDER_API,
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
        data=json.dumps(order_data),
        headers={'Content-Type': 'application/json'}
    )
    if response.status_code in [200, 201]:
        return response.json()
    else:
        raise Exception(f"Order creation failed: {response.text}")

def verify_payment_signature(order_id, payment_id, razorpay_signature, secret):
    message = f"{order_id}|{payment_id}".encode('utf-8')
    generated_signature = hmac.new(
        secret.encode('utf-8'),
        msg=message,
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(generated_signature, razorpay_signature)


# 1) ADD USER 
@app.route('/api/add_user', methods=['POST'])
def add_user():
    plan_map = {'free': 10, 'pluse': 15, 'edge': 30, 'prime': 60}
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    required = ['user_name', 'user_email', 'user_password', 'user_age', 'username', 'created_by']
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({'status': 0, 'message': f'Missing keys: {missing}'}), 400

    user_name     = data['user_name'].strip()
    user_email    = data['user_email'].strip().lower()
    user_password = data['user_password'].strip()
    user_age      = data['user_age'].strip()
    username      = data['username'].strip()
    created_by    = data['created_by'].strip()

    if len(username) > 10:
        return jsonify({'status': 0, 'message': 'Username must be at most 10 characters'}), 400

    user_mobile   = data.get('user_mobile', '').strip()
    user_status   = data.get('user_status', '1').strip()
    delete_user_flag = '0'

    param1_val = data.get('param1', '')
    param2_val = data.get('param2', '')
    param3_val = data.get('param3', '')
    param4_val = data.get('param4', '')
    param5_val = data.get('param5', '')
    param6_val = data.get('param6', '')
    param7_val = data.get('param7', '')

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # Step 1: Check for user_email/username/mobile
    existing_user_id = None
    cursor.execute("SELECT user_id, verified FROM users WHERE user_email=%s AND delete_user='0'", (user_email,))
    row = cursor.fetchone()
    if row:
        if row['verified'] == 1:
            cursor.close()
            db.close()
            return jsonify({'status': 0, 'message': 'Duplicate entry: Email already exists and is verified'}), 409
        else:
            existing_user_id = row['user_id']
    else:
        cursor.execute("SELECT user_id, verified FROM users WHERE username=%s AND delete_user='0'", (username,))
        row = cursor.fetchone()
        if row:
            if row['verified'] == 1:
                cursor.close()
                db.close()
                return jsonify({'status': 0, 'message': 'Duplicate entry: Username already exists and is verified'}), 409
            else:
                existing_user_id = row['user_id']
        else:
            if user_mobile:
                cursor.execute("SELECT user_id, verified FROM users WHERE user_mobile=%s AND delete_user='0'", (user_mobile,))
                row = cursor.fetchone()
                if row:
                    if row['verified'] == 1:
                        cursor.close()
                        db.close()
                        return jsonify({'status': 0, 'message': 'Duplicate entry: Mobile already exists and is verified'}), 409
                    else:
                        existing_user_id = row['user_id']

    hashed_pass   = hash_password(user_password)
    user_token    = generate_user_token(16)
    created_date  = now_in_india()

    # If no existing user => insert a new one
    if not existing_user_id:
        insert_query = """
        INSERT INTO users (
          user_name, user_mobile, user_email, user_password,
          user_age, verified, otp, user_token, created_date,
          created_by, modification_date, modification_by, delete_user,
          user_status, username, plan_name, requests_remaining,
          param1, param2, param3, param4, param5, param6, param7
        )
        VALUES (
          %s, %s, %s, %s,
          %s, 0, '', %s, %s,
          %s, NULL, NULL, %s,
          %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s, %s
        )
        """
        cursor.execute(insert_query, (
          user_name, 
          user_mobile, 
          user_email, 
          hashed_pass,
          user_age, 
          user_token, 
          created_date,
          created_by, 
          delete_user_flag, 
          user_status, 
          username,
          'free',                 # Give "free" plan on creation
          plan_map['free'],       # 10 free requests on creation
          param1_val, param2_val, param3_val, param4_val, param5_val,
          param6_val, param7_val
        ))
        db.commit()
        existing_user_id = cursor.lastrowid
    else:
        # Update the existing unverified record with new details
        update_query = """
        UPDATE users
        SET
          user_name=%s,
          user_mobile=%s,
          user_email=%s,
          user_password=%s,
          user_age=%s,
          verified=0,
          user_token=%s,
          modification_date=%s,
          modification_by=%s,
          user_status=%s,
          username=%s,
          plan_name='free',
          requests_remaining=%s,
          param1=%s, param2=%s, param3=%s, param4=%s, param5=%s, param6=%s, param7=%s
        WHERE user_id=%s
        """
        cursor.execute(update_query, (
            user_name,
            user_mobile,
            user_email,
            hashed_pass,
            user_age,
            user_token,
            now_in_india(),
            created_by,
            user_status,
            username,
            plan_map['free'],   # reset to 10 on re-registration
            param1_val, param2_val, param3_val, param4_val, param5_val, param6_val, param7_val,
            existing_user_id
        ))
        db.commit()

    # Generate OTP, store it, send
    new_otp = generate_otp()
    new_otp_time = now_in_india().isoformat()
    cursor.execute("""
        UPDATE users
        SET otp=%s, param1=%s, modification_date=%s, modification_by=%s
        WHERE user_id=%s
    """, (
        new_otp,
        new_otp_time,
        now_in_india(),
        user_email,
        existing_user_id
    ))
    db.commit()

    send_otp_email(user_email, new_otp)
    cursor.close()
    db.close()

    return jsonify({
        'status': 1,
        'message': 'User data processed successfully (verification still = 0). OTP sent to email.',
        'username': username,
        'user_token': user_token
    }), 201


@app.route('/api/send_otp', methods=['POST'])
def send_otp_route():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    user_email = data.get('user_email', '').strip().lower()
    if not user_email:
        return jsonify({'status': 0, 'message': 'Email is required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE user_email=%s AND delete_user='0'", (user_email,))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or is soft-deleted'}), 404

    # Generate new OTP and update
    new_otp = generate_otp()
    new_otp_time = now_in_india().isoformat()
    update_query = """
        UPDATE users
        SET otp=%s, param1=%s, modification_date=%s, modification_by=%s
        WHERE user_id=%s
    """
    cursor.execute(update_query, (new_otp, new_otp_time, now_in_india(), user_email, user['user_id']))
    db.commit()

    # Send the OTP via email
    send_otp_email(user_email, new_otp)

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': 'OTP sent successfully'}), 200


# 2) VERIFY OTP 
@app.route('/api/verify_otp', methods=['POST'])
def verify_otp():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    user_email = data.get('user_email', '').strip().lower()
    otp_input  = data.get('otp', '').strip()

    if not user_email or not otp_input:
        return jsonify({'status': 0, 'message': 'Email and OTP are required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE user_email=%s AND delete_user='0'", (user_email,))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or is soft-deleted'}), 404

    if user['otp'] != otp_input:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'Invalid OTP'}), 400

    otp_created_at_str = user['param1']
    if not otp_created_at_str:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'Missing OTP timestamp'}), 400

    try:
        otp_created_at = datetime.fromisoformat(otp_created_at_str)
        if otp_created_at.tzinfo is None:
            # If it's naive, localize to IST
            otp_created_at = timezone('Asia/Kolkata').localize(otp_created_at)
        # else, aware - use as is (could be IST or another TZ, but isoformat recorded with IST, so it's safe)
    except Exception:
        otp_created_at = None


    if not otp_created_at:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'Invalid OTP timestamp'}), 400

    now = now_in_india()
    # If older than 12 hours, permanently delete user
    if (now - otp_created_at).total_seconds() > 12 * 3600:
        del_query = "DELETE FROM users WHERE user_id=%s"
        cursor.execute(del_query, (user['user_id'],))
        db.commit()
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'Verification failed: more than 12 hours. User deleted.'}), 400

    # Check 5-min OTP validity
    if (now - otp_created_at).total_seconds() > 300:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'OTP expired'}), 400

    # Mark verified=1 if it was 0
    verified_val = user['verified']
    if verified_val == 0:
        verified_val = 1

    update_query = """
        UPDATE users
        SET verified=%s, otp='', 
            modification_date=%s,
            modification_by=%s,
            param1=''
        WHERE user_id=%s
    """
    cursor.execute(update_query, (verified_val, now, user_email, user['user_id']))
    db.commit()

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': 'OTP verified successfully'}), 200


# 3) LOGIN
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    user_email = data.get('user_email', '').strip().lower()
    plain_pass = data.get('user_password', '').strip()
    if not user_email or not plain_pass:
        return jsonify({'status': 0, 'message': 'Email and password are required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE user_email=%s AND delete_user='0'", (user_email,))
    user = cursor.fetchone()
    cursor.close()
    db.close()

    if not user:
        return jsonify({'status': 0, 'message': 'User not found or is soft-deleted'}), 404

    if not verify_password(plain_pass, user['user_password']):
        return jsonify({'status': 0, 'message': 'Password incorrect'}), 401

    if user['verified'] == 0:
        return jsonify({'status': 0, 'message': 'Email not verified'}), 403

    return jsonify({
        'status': 1,
        'message': 'Login successful',
        'username': user['username'],
        'user_token': user['user_token']
    }), 200


# 4) FORGOT PASSWORD 
#    CHANGED: now also returns user_token
@app.route('/api/forgot_password', methods=['POST'])
def forgot_password():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    user_email   = data.get('user_email', '').strip().lower()
    new_password = data.get('new_password', '').strip()
    if not user_email or not new_password:
        return jsonify({'status': 0, 'message': 'Email and new_password required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE user_email=%s AND delete_user='0'", (user_email,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or soft-deleted'}), 404

    hashed_new = hash_password(new_password)
    update_query = """
        UPDATE users
        SET user_password=%s, modification_date=%s, modification_by=%s
        WHERE user_id=%s
    """
    cursor.execute(update_query, (hashed_new, now_in_india(), "forgot_password", user["user_id"]))
    db.commit()

    user_token = user['user_token']
    cursor.close()
    db.close()
    return jsonify({
        'status': 1,
        'message': 'Password reset successfully',
        'user_token': user_token
    }), 200


# 5) USER FEEDBACK
@app.route('/api/user_feedback', methods=['POST'])
def user_feedback():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    username    = data.get('username', '').strip()
    user_token  = data.get('user_token', '').strip()
    feedback_msg= data.get('feedback', '').strip()
    user_query  = data.get('user_query', '').strip()

    if not username or not user_token or not feedback_msg:
        return jsonify({'status': 0, 'message': 'username, user_token, and feedback are required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT user_id FROM users WHERE username=%s AND user_token=%s AND delete_user='0'", 
                   (username, user_token))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or invalid token'}), 404

    insert_query = """
        INSERT INTO user_feedback (username, feedback, user_query, created_date)
        VALUES (%s, %s, %s, %s)
    """
    cursor.execute(insert_query, (username, feedback_msg, user_query, now_in_india()))
    db.commit()

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': 'Feedback saved successfully'}), 200


# 5a) GET USER FEEDBACK
@app.route('/api/get_user_feedback', methods=['POST'])
def get_user_feedback():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    username   = data.get('username', '').strip()
    user_token = data.get('user_token', '').strip()

    if not username or not user_token:
        return jsonify({'status': 0, 'message': 'username and user_token are required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    # Verify user
    cursor.execute("SELECT user_id FROM users WHERE username=%s AND user_token=%s AND delete_user='0'", 
                   (username, user_token))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or invalid token'}), 404

    cursor.execute("SELECT feedback_id, username, feedback, user_query, created_date FROM user_feedback WHERE username=%s",
                   (username,))
    rows = cursor.fetchall()
    cursor.close()
    db.close()

    return jsonify({'status': 1, 'message': 'OK', 'feedback_records': rows}), 200


# 6) CHECK ANY 
#    CHANGED: only records with verified=1 are considered "found"
@app.route('/api/check_any', methods=['GET'])
def check_any():
    user_email = request.form.get('user_email','').strip().lower()
    username   = request.form.get('username','').strip()
    user_mobile= request.form.get('user_mobile','').strip()

    if not user_email and not username and not user_mobile:
        return jsonify({'status': 0, 'found': 0, 'message': 'Provide at least one'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    found = 0

    if user_email:
        cursor.execute("SELECT user_id FROM users WHERE user_email=%s AND verified=1 AND delete_user='0'", (user_email,))
    elif username:
        cursor.execute("SELECT user_id FROM users WHERE username=%s AND verified=1 AND delete_user='0'", (username,))
    else:
        cursor.execute("SELECT user_id FROM users WHERE user_mobile=%s AND verified=1 AND delete_user='0'", (user_mobile,))

    if cursor.fetchone():
        found = 1

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'found': found, 'message': 'Check complete'}), 200


@app.route('/api/get_user_info', methods=['POST'])
def get_user_info():
    plan_map = {'free': 10, 'pluse': 15, 'edge': 30, 'prime': 60}
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    user_token = data.get('user_token', '').strip()
    if not user_token:
        return jsonify({'status': 0, 'message': 'Must provide user_token'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE user_token=%s AND delete_user='0'", (user_token,))
    user = cursor.fetchone()

    billing_history = []
    if user:
        cursor.execute("""
            SELECT subscribed_at, plan_name, status
            FROM user_billing_history
            WHERE user_id=%s
            ORDER BY subscribed_at DESC
        """, (user['user_id'],))
        billing_history = [
            [
                row["subscribed_at"].strftime('%Y-%m-%d %H:%M:%S') if row["subscribed_at"] else "",
                row["plan_name"],
                row["status"]
            ]
            for row in cursor.fetchall()
        ]
    cursor.close()
    db.close()

    if not user:
        return jsonify({'status': 0, 'message': 'User not found or soft-deleted'}), 404

    plan_name = (user['plan_name'] or 'free').lower()
    max_requests = plan_map.get(plan_name, 10)
    requests_remaining = user['requests_remaining'] if user['requests_remaining'] is not None else 0

    plan_updated_time = user['modification_date'] or user['created_date']
    if plan_updated_time:
        if not isinstance(plan_updated_time, str):
            plan_updated_time_str = plan_updated_time.strftime('%Y-%m-%d %H:%M:%S')
        else:
            plan_updated_time_str = plan_updated_time
    else:
        plan_updated_time_str = ""

    return jsonify({
        'status': 1,
        'message': 'User info retrieved successfully',
        'user_info': {
            'user_name': user['user_name'],
            'user_mobile': user['user_mobile'],
            'user_email': user['user_email'],
            'user_age': user['user_age'],
            'username': user['username'],
            'plan_name': plan_name,
            'requests_remaining': requests_remaining,
            'plan_max_requests': max_requests,
            'plan_subscribed_at': plan_updated_time_str,
            'billing_history': billing_history
        }
    }), 200

@app.route('/api/update_user_profile', methods=['POST'])
def update_user_profile():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    username   = data.get('username', '').strip()
    user_token = data.get('user_token', '').strip()
    new_name   = data.get('user_name', '').strip()
    new_age    = data.get('user_age', '').strip()

    if not username and not user_token:
        return jsonify({'status': 0, 'message': 'Must provide username or user_token'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    if username:
        cursor.execute("SELECT * FROM users WHERE username=%s AND delete_user='0'", (username,))
    else:
        cursor.execute("SELECT * FROM users WHERE user_token=%s AND delete_user='0'", (user_token,))

    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or soft-deleted'}), 404

    updates = []
    vals    = []

    if new_name:
        updates.append("user_name=%s")
        vals.append(new_name)
    if new_age:
        try:
            updates.append("user_age=%s")
            vals.append(int(new_age))
        except:
            pass

    if not updates:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'No valid fields to update'}), 400

    update_query = f"""
       UPDATE users
       SET {', '.join(updates)},
           modification_date=%s,
           modification_by=%s
       WHERE user_id=%s
    """
    vals.append(now_in_india())
    vals.append(user['username'])  # who is modifying
    vals.append(user['user_id'])

    cursor.execute(update_query, tuple(vals))
    db.commit()

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': 'User profile updated successfully'}), 200


# 9) PLAN & REQUESTS MANAGEMENT


# ------------------------ RAZORPAY ORDER API -------------------------


@app.route('/api/create_order', methods=['POST'])
def api_create_order():
    data = request.get_json(silent=True) or request.form.to_dict()
    username   = data.get('username', '').strip()
    amount     = float(data.get('amount', 0))
    plan_name  = data.get('plan_name', '').strip()
    if not username or not plan_name or amount <= 0:
        return jsonify({'status': 0, 'message': 'username, amount, and plan_name are required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM users WHERE username=%s AND verified=1 AND delete_user='0'",
        (username,)
    )
    user = cursor.fetchone()

    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'Username not found, not verified, or deleted'}), 404

    try:
        order = create_razorpay_order(username, amount, plan_name)
        order_id = order['id']

        # STORE latest order_id on USER!
        cursor.execute("UPDATE users SET order_id=%s, modification_date=%s WHERE user_id=%s",
            (order_id, now_in_india(), user['user_id']))
        db.commit()
        cursor.close()
        db.close()

        return jsonify({'status': 1, "order_id": order_id, "amount": order['amount'], "razorpay_id": RAZORPAY_KEY_ID}), 200
    except Exception as e:
        return jsonify({'status': 0, "message": str(e)}), 500
    


# Optional (quick) verify handler
@app.route('/api/verify_payment', methods=['POST'])
def api_verify_payment():
    data = request.get_json(silent=True) or request.form.to_dict()
    order_id = data.get('razorpay_order_id').strip()
    payment_id = data.get('razorpay_payment_id').strip()
    signature = data.get('razorpay_signature').strip()
    if verify_payment_signature(order_id, payment_id, signature, RAZORPAY_KEY_SECRET):
        return jsonify({"status": "success"})
    else:
        return jsonify({"status": "failure"})


@app.route('/api/set_plan', methods=['POST'])
def set_plan():
    plan_map = {'free': 10, 'pluse': 15, 'edge': 30, 'prime': 60}
    data = request.get_json(silent=True) or request.form.to_dict()
    username       = data.get('username', '').strip()
    user_token     = data.get('user_token', '').strip()
    plan_name      = data.get('plan_name', '').strip().lower()
    payment_status = data.get('payment_status', '').strip().lower()
    order_id       = data.get('order_id', '')
    param1         = data.get('param1', '')
    param2         = data.get('param2', '')
    param3         = data.get('param3', '')

    if not (username or user_token):
        return jsonify({'status': 0, 'message': 'Must provide username or user_token'}), 400
    if plan_name not in plan_map:
        return jsonify({'status': 0, 'message': 'Invalid plan_name ("free"/"pluse"/"edge"/"prime")'}), 400
    if payment_status not in ['paid', 'unpaid']:
        return jsonify({'status': 0, 'message': 'Invalid payment_status (paid/unpaid)'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    if username:
        cursor.execute("SELECT * FROM users WHERE username=%s AND delete_user='0'", (username,))
    else:
        cursor.execute("SELECT * FROM users WHERE user_token=%s AND delete_user='0'", (user_token,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or soft-deleted'}), 404

    if not order_id:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'Order ID required'}), 400

    new_reqs = plan_map[plan_name]
    now      = now_in_india()
    order_match = (order_id == (user.get("order_id") or ""))

    # Always add billing history
    cursor.execute("""
        INSERT INTO user_billing_history
        (user_id, plan_name, status, subscribed_at, order_id, param1, param2, param3)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        user['user_id'],
        plan_name,
        payment_status,
        now,
        order_id,
        param1, param2, param3,
    ))
    db.commit()

    plan_set = False
    if payment_status == "paid" and order_match:
        current = user['requests_remaining'] if user['requests_remaining'] is not None else 0
        cursor.execute("""
            UPDATE users
            SET plan_name=%s, 
                requests_remaining=%s,
                modification_date=%s,
                modification_by=%s,
                order_id=NULL
            WHERE user_id=%s
        """, (plan_name, current+new_reqs, now, user['username'], user['user_id']))
        db.commit()
        plan_set = True
        send_plan_purchase_email(user['user_email'], user['user_name'] or user['username'], plan_name, order_id)

    cursor.close()
    db.close()

    return jsonify({'status': 1, 'message': f'Plan update: {"DONE" if plan_set else "NOT DONE (unpaid or wrong order_id)"}', 'plan_set': plan_set}), 200


# 3. DEDUCT REQUESTS, SEND ALERTS ON LOW/0 REMAINING
@app.route('/api/deduct_request', methods=['POST'])
def deduct_request():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    username   = data.get('username', '').strip()
    user_token = data.get('user_token', '').strip()
    if not username and not user_token:
        return jsonify({'status': 0, 'message': 'Must provide username or user_token'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username=%s AND user_token=%s AND delete_user='0'", (username, user_token))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or soft-deleted'}), 404

    cur_requests = user['requests_remaining'] or 0
    if cur_requests <= 0:
        cursor.close()
        db.close()
        # mail already sent on 0 before, do not spam
        return jsonify({'status': 0, 'message': 'No remaining requests left'}), 400

    new_reqs = cur_requests - 1
    cursor.execute("""
        UPDATE users
        SET requests_remaining=%s,
            modification_date=%s,
            modification_by=%s
        WHERE user_id=%s
    """, (new_reqs, now_in_india(), user['username'], user['user_id']))
    db.commit()

    # Alert mail logic:
    if new_reqs == 2:
        send_request_alert_email(user['user_email'], user['user_name'] or user['username'], 2)
    if new_reqs == 0:
        send_request_alert_email(user['user_email'], user['user_name'] or user['username'], 0)

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': 'Request deducted', 'remaining': new_reqs}), 200


@app.route('/api/get_remaining_requests', methods=['POST'])
def get_remaining_requests():
    plan_map = {'free': 10, 'pluse': 15, 'edge': 30, 'prime': 60}
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    user_token = data.get('user_token', '').strip()
    if not user_token:
        return jsonify({'status': 0, 'message': 'Must provide user_token'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT requests_remaining, plan_name FROM users WHERE user_token=%s AND delete_user='0'", (user_token,))
    user = cursor.fetchone()
    cursor.close()
    db.close()

    if not user:
        return jsonify({'status': 0, 'message': 'User not found or soft-deleted'}), 404

    remaining = user['requests_remaining'] or 0
    plan_name = user['plan_name']
    return jsonify({
        'status': 1,
        'message': 'OK',
        'requests_remaining': remaining,
        'plan_name': plan_name
    }), 200


@app.route('/api/soft_delete_user', methods=['POST'])
def soft_delete_user():
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    username   = data.get('username', '').strip()
    user_token = data.get('user_token', '').strip()
    if not username and not user_token:
        return jsonify({'status': 0, 'message': 'Must provide username or user_token'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    if username:
        cursor.execute("SELECT * FROM users WHERE username=%s AND delete_user='0'", (username,))
    else:
        cursor.execute("SELECT * FROM users WHERE user_token=%s AND delete_user='0'", (user_token,))

    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found or already deleted'}), 404

    username_placeholder = f"DEL{user['user_id']}"
    if len(username_placeholder) > 10:
        username_placeholder = username_placeholder[:10]
    email_placeholder = f"{user['user_email']}-{user['user_id']}-deleted"

    update_sql = """
        UPDATE users
        SET delete_user='1',
            user_name='',
            user_mobile='',
            user_email=%s,
            user_password='',
            user_age=0,
            username=%s,
            modification_date=%s,
            modification_by=%s
        WHERE user_id=%s
    """
    cursor.execute(update_sql, (
        email_placeholder,
        username_placeholder,
        now_in_india(),
        'soft_delete',
        user['user_id']
    ))
    db.commit()
    cursor.close()
    db.close()

    return jsonify({'status': 1, 'message': 'User soft-deleted successfully'}), 200


# 11) CLEANUP UNVERIFIED
@app.route('/api/cleanup_unverified', methods=['GET'])
def cleanup_unverified():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    del_query = """
        DELETE FROM users
        WHERE verified=0
          AND param1!=''
          AND param1 < DATE_SUB(NOW(), INTERVAL 12 HOUR)
    """
    cursor.execute(del_query)
    db.commit()
    count_rows = cursor.rowcount

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': f'{count_rows} unverified users removed.'}), 200


@app.route('/api/save_contact_info', methods=['POST'])
def save_contact_info():
    """
    Stores contact info (Name, email, Subject, Message) openly (no user check).
    user_name/user_token references are removed, as requested.
    """
    data = request.get_json(silent=True) or request.form.to_dict()
    if not data:
        return jsonify({'status': 0, 'message': 'No data received'}), 400

    name_val   = data.get('name', '').strip()
    email_val  = data.get('email', '').strip()
    subject    = data.get('subject', '').strip()
    message    = data.get('message', '').strip()

    # No strict requirement beyond that; store openly.
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    insert_query = """
       INSERT INTO contact_info
       (name, email, subject, message, created_date)
       VALUES
       (%s, %s, %s, %s, %s)
    """
    cursor.execute(insert_query, (
       name_val, 
       email_val, 
       subject, 
       message, 
       now_in_india()
    ))
    db.commit()

    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': 'Contact info saved successfully'}), 200


import json

@app.route('/api/store_query', methods=['POST'])
def store_query():
    data = request.get_json(silent=True) or request.form.to_dict()
    username   = data.get('username', '').strip()
    user_token = data.get('user_token', '').strip()
    user_query = data.get('user_query', '').strip()

    # Accept dict/JSON or string for response
    raw_response = data.get('response', '')
    # If response is a dict or list, convert to JSON string; otherwise store as is.
    if isinstance(raw_response, (dict, list)):
        response_str = json.dumps(raw_response, ensure_ascii=False)
    else:
        # Sometimes form-data/post string may look like JSON but is str, not dict
        # You can even try loading and dumping if you want:
        try:
            # Try if it's a JSON-string but not parsed, make it pretty
            parsed = json.loads(raw_response)
            response_str = json.dumps(parsed, ensure_ascii=False)
        except Exception:
            response_str = raw_response  # Just store as is

    if not (username or user_token) or not user_query:
        return jsonify({'status': 0, 'message': 'username/usertoken and user_query required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    if username:
        cursor.execute("SELECT user_id FROM users WHERE username=%s AND delete_user='0'", (username,))
    else:
        cursor.execute("SELECT user_id FROM users WHERE user_token=%s AND delete_user='0'", (user_token,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found'}), 404

    cursor.execute(
        "INSERT INTO user_queries (username, user_token, user_query, response, created_date) VALUES (%s, %s, %s, %s, %s)",
        (username, user_token, user_query, response_str, now_in_india())
    )
    db.commit()
    cursor.close()
    db.close()
    return jsonify({'status': 1, 'message': 'Query stored successfully'}), 200




@app.route('/api/get_user_queries', methods=['POST'])
def get_user_queries():
    data = request.get_json(silent=True) or request.form.to_dict()
    username   = data.get('username', '').strip()
    user_token = data.get('user_token', '').strip()
    if not (username or user_token):
        return jsonify({'status': 0, 'message': 'username or user_token required'}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    # Only retrieve if user exists
    if username:
        cursor.execute("SELECT user_id FROM users WHERE username=%s AND delete_user='0'", (username,))
    else:
        cursor.execute("SELECT user_id FROM users WHERE user_token=%s AND delete_user='0'", (user_token,))
    user = cursor.fetchone()
    if not user:
        cursor.close()
        db.close()
        return jsonify({'status': 0, 'message': 'User not found'}), 404

    if username:
        cursor.execute("SELECT id, username, user_token, user_query, response, created_date FROM user_queries WHERE username=%s ORDER BY created_date DESC", (username,))
    else:
        cursor.execute("SELECT id, username, user_token, user_query, response, created_date FROM user_queries WHERE user_token=%s ORDER BY created_date DESC", (user_token,))
    rows = cursor.fetchall()
    cursor.close()
    db.close()

    # Parse the JSON stored in response
    for rec in rows:
        resp = rec.get("response", "")
        if resp:
            try:
                rec["response"] = json.loads(resp)
            except Exception:
                # If not valid JSON, leave as is
                pass

    return jsonify({'status': 1, 'user_queries': rows}), 200



@app.route('/api/all_signedup_users', methods=['GET'])
def all_signedup_users():
    """
    Returns all verified and non-deleted users for Excel export.
    """
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            user_name, user_mobile, user_email, user_age, created_date, plan_name, requests_remaining
        FROM users
        WHERE verified=1 AND delete_user='0'
        ORDER BY created_date DESC
    """)

    records = []
    for row in cursor.fetchall():
        # Format created_date to string for Excel/JSON if it's a datetime
        if isinstance(row['created_date'], (datetime, )):
            row['created_date'] = row['created_date'].strftime('%Y-%m-%d %H:%M:%S')
        records.append(row)

    cursor.close()
    db.close()

    return jsonify({
        'status': 1,
        'message': 'List of all signed up verified users',
        'records': records
    }), 200

# -------------------------------------------------------------------
# MAIN
# -------------------------------------------------------------------
if __name__ == '__main__':
    serve(
        app,
        host='0.0.0.0',
        port=5809,
        threads=multiprocessing.cpu_count(),
        url_scheme='https'
    )
from flask import Flask, render_template, request, jsonify
import sqlite3
import logging

app = Flask(__name__)

# Configuration des logs pour déboguer facilement
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialisation de la base de données
def init_db():
    try:
        conn = sqlite3.connect('database.sqlite')
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users 
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, age INTEGER, gender TEXT, weight REAL, height REAL, goal TEXT, activity TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS food_log 
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, food_name TEXT, quantity REAL, calories REAL, proteins REAL, carbs REAL, fats REAL)''')
        c.execute('''CREATE TABLE IF NOT EXISTS water_log 
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, quantity REAL)''')
        conn.commit()
        logger.info("Base de données initialisée avec succès.")
    except sqlite3.Error as e:
        logger.error(f"Erreur lors de l'initialisation de la base de données : {e}")
    finally:
        conn.close()

# Initialisation au démarrage
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/save_profile', methods=['POST'])
def save_profile():
    try:
        data = request.get_json()
        logger.debug(f"Données reçues : {data}")

        # Vérification des champs obligatoires
        required_fields = ['age', 'gender', 'weight', 'height', 'goal', 'activity']
        for field in required_fields:
            if field not in data or data[field] is None:
                logger.error(f"Champ manquant ou invalide : {field}")
                return jsonify({'error': f'Champ {field} manquant ou invalide'}), 400

        # Conversion des types pour éviter les erreurs SQLite
        age = int(data['age'])
        weight = float(data['weight'])
        height = float(data['height'])
        gender = str(data['gender'])
        goal = str(data['goal'])
        activity = str(data['activity'])

        # Vérification des valeurs
        if age <= 0 or weight <= 0 or height <= 0:
            logger.error("Valeurs numériques invalides (négatives ou nulles)")
            return jsonify({'error': 'Les valeurs numériques doivent être positives'}), 400
        if gender not in ['male', 'female'] or goal not in ['cut', 'maintain', 'bulk'] or activity not in ['sedentary', 'moderate', 'active', 'very_active']:
            logger.error("Valeurs de sélection invalides")
            return jsonify({'error': 'Valeurs de sélection invalides'}), 400

        # Connexion à la base de données
        conn = sqlite3.connect('database.sqlite')
        c = conn.cursor()
        c.execute('INSERT OR REPLACE INTO users (id, age, gender, weight, height, goal, activity) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  (1, age, gender, weight, height, goal, activity))  # ID fixé à 1 pour simplifier
        conn.commit()
        logger.info("Profil sauvegardé avec succès.")

        # Calcul du BMR (Mifflin-St Jeor)
        bmr = 10 * weight + 6.25 * height - 5 * age + (5 if gender == 'male' else -161)
        activity_factors = {'sedentary': 1.2, 'moderate': 1.375, 'active': 1.55, 'very_active': 1.725}
        calories = bmr * activity_factors[activity]

        # Ajustement selon l'objectif
        if goal == 'cut':
            calories *= 0.85
        elif goal == 'bulk':
            calories *= 1.15

        # Calcul des macros (exemple : 30% protéines, 40% glucides, 30% lipides)
        proteins = (calories * 0.30) / 4
        carbs = (calories * 0.40) / 4
        fats = (calories * 0.30) / 9

        response = {
            'user_id': 1,
            'calories': calories,
            'macros': {'proteins': proteins, 'carbs': carbs, 'fats': fats}
        }
        logger.debug(f"Réponse envoyée : {response}")
        return jsonify(response), 200

    except sqlite3.Error as e:
        logger.error(f"Erreur SQLite : {e}")
        return jsonify({'error': f'Erreur de base de données : {str(e)}'}), 500
    except ValueError as e:
        logger.error(f"Erreur de conversion des données : {e}")
        return jsonify({'error': 'Valeurs numériques invalides'}), 400
    except Exception as e:
        logger.error(f"Erreur inattendue : {e}")
        return jsonify({'error': f'Erreur serveur : {str(e)}'}), 500
    finally:
        if 'conn' in locals():
            conn.close()

@app.route('/add_food', methods=['POST'])
def add_food():
    try:
        data = request.get_json()
        conn = sqlite3.connect('database.sqlite')
        c = conn.cursor()
        c.execute('INSERT INTO food_log (user_id, food_name, quantity, calories, proteins, carbs, fats) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  (data['user_id'], data['food_name'], data['quantity'], data['calories'], data['proteins'], data['carbs'], data['fats']))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        logger.error(f"Erreur lors de l’ajout d’un aliment : {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/add_water', methods=['POST'])
def add_water():
    try:
        data = request.get_json()
        conn = sqlite3.connect('database.sqlite')
        c = conn.cursor()
        c.execute('INSERT INTO water_log (user_id, quantity) VALUES (?, ?)', (data['user_id'], data['quantity']))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        logger.error(f"Erreur lors de l’ajout d’eau : {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_food', methods=['POST'])
def delete_food():
    try:
        data = request.get_json()
        conn = sqlite3.connect('database.sqlite')
        c = conn.cursor()
        c.execute('DELETE FROM food_log WHERE id = ? AND user_id = ?', (data['food_id'], data['user_id']))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        logger.error(f"Erreur lors de la suppression d’un aliment : {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_data/<int:user_id>', methods=['GET'])
def get_data(user_id):
    try:
        conn = sqlite3.connect('database.sqlite')
        c = conn.cursor()
        c.execute('SELECT id, user_id, food_name, quantity, calories, proteins, carbs, fats FROM food_log WHERE user_id = ?', (user_id,))
        food_data = c.fetchall()
        c.execute('SELECT SUM(quantity) FROM water_log WHERE user_id = ?', (user_id,))
        water_total = c.fetchone()[0] or 0
        conn.close()
        return jsonify({'food': food_data, 'water': water_total}), 200
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des données : {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
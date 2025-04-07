// Variables globales
let userId = null;
let waterGoal = 0;
let calorieGoal = 0;
let macrosGoal = { proteins: 0, carbs: 0, fats: 0 };
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let recentFoods = JSON.parse(localStorage.getItem('recentFoods')) || [];

document.addEventListener('DOMContentLoaded', function() {
    updateFavorites();
    updateSuggestions();
    // Initialisation des valeurs par défaut
    document.getElementById('calories-remaining').textContent = "0/0";
    document.getElementById('proteins-remaining').textContent = "0/0";
    document.getElementById('carbs-remaining').textContent = "0/0";
    document.getElementById('fats-remaining').textContent = "0/0";
    document.getElementById('water-goal').textContent = "Non défini";
    document.getElementById('water-info').textContent = "";
});

// Gestion de la soumission du profil
document.getElementById('profile-form').addEventListener('submit', function(e) {
    e.preventDefault();
    console.log("Formulaire soumis");

    const data = {
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        weight: parseFloat(document.getElementById('weight').value),
        height: parseFloat(document.getElementById('height').value),
        goal: document.getElementById('goal').value,
        activity: document.getElementById('activity').value
    };

    if (isNaN(data.age) || isNaN(data.weight) || isNaN(data.height)) {
        alert('Veuillez remplir tous les champs numériques correctement.');
        return;
    }

    fetch('/save_profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Erreur serveur'); });
        }
        return response.json();
    })
    .then(result => {
        console.log("Profil reçu:", result);
        userId = result.user_id;
        calorieGoal = result.calories;
        macrosGoal = result.macros;

        // Calcul de l’objectif d’eau
        const baseWater = data.weight * 30; // 30 ml/kg
        const activityAdjustment = { 'sedentary': 0, 'moderate': 500, 'active': 1000, 'very_active': 1500 };
        const goalAdjustment = { 'cut': 200, 'maintain': 0, 'bulk': 300 };
        waterGoal = baseWater + activityAdjustment[data.activity] + goalAdjustment[data.goal];

        // Mise à jour des éléments HTML (suppression des doublons)
        document.getElementById('calories-remaining').textContent = `0/${calorieGoal.toFixed(0)}`;
        document.getElementById('proteins-remaining').textContent = `0/${macrosGoal.proteins.toFixed(0)}`;
        document.getElementById('carbs-remaining').textContent = `0/${macrosGoal.carbs.toFixed(0)}`;
        document.getElementById('fats-remaining').textContent = `0/${macrosGoal.fats.toFixed(0)}`;
        document.getElementById('water-goal').textContent = (waterGoal / 1000).toFixed(1);
        document.getElementById('water-info').textContent = "Besoin quotidien basé sur votre poids, activité et objectif.";
        document.getElementById('calorie-explanation').textContent = `Tu as besoin de ${calorieGoal.toFixed(0)} kcal pour maintenir ton poids. Pour ${data.goal === 'cut' ? 'une sèche' : data.goal === 'bulk' ? 'une prise de masse' : 'le maintien'}, vise ${(data.goal === 'cut' ? calorieGoal * 0.85 : data.goal === 'bulk' ? calorieGoal * 1.15 : calorieGoal).toFixed(0)} kcal.`;

        updateData();
    })
    .catch(error => {
        console.error('Erreur lors de la soumission:', error);
        alert(`Erreur lors de la soumission du profil : ${error.message}`);
    });
});

// Ajout d’un aliment
function addFood() {
    if (!userId) {
        alert('Veuillez soumettre votre profil d’abord.');
        return;
    }

    const portion = parseFloat(document.getElementById('food-portion').value);
    const caloriesPer100g = parseFloat(document.getElementById('food-calories').value);
    const proteinsPer100g = parseFloat(document.getElementById('food-proteins').value);
    const carbsPer100g = parseFloat(document.getElementById('food-carbs').value);
    const fatsPer100g = parseFloat(document.getElementById('food-fats').value);

    if (isNaN(portion) || isNaN(caloriesPer100g) || isNaN(proteinsPer100g) || isNaN(carbsPer100g) || isNaN(fatsPer100g)) {
        alert('Veuillez remplir tous les champs numériques.');
        return;
    }

    const data = {
        user_id: userId,
        food_name: document.getElementById('food-name').value,
        quantity: portion,
        calories: (caloriesPer100g * portion) / 100,
        proteins: (proteinsPer100g * portion) / 100,
        carbs: (carbsPer100g * portion) / 100,
        fats: (fatsPer100g * portion) / 100
    };

    fetch('/add_food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) throw new Error('Erreur lors de l’ajout de l’aliment');
        console.log("Aliment ajouté:", data);
        recentFoods.unshift({ name: data.food_name, calories: caloriesPer100g, proteins: proteinsPer100g, carbs: carbsPer100g, fats: fatsPer100g });
        if (recentFoods.length > 10) recentFoods.pop();
        localStorage.setItem('recentFoods', JSON.stringify(recentFoods));
        document.getElementById('food-name').value = '';
        document.getElementById('food-portion').value = '';
        document.getElementById('food-calories').value = '';
        document.getElementById('food-proteins').value = '';
        document.getElementById('food-carbs').value = '';
        document.getElementById('food-fats').value = '';
        updateSuggestions();
        updateData();
        document.getElementById('food-table').classList.add('added-feedback');
        setTimeout(() => document.getElementById('food-table').classList.remove('added-feedback'), 500);
    })
    .catch(error => {
        console.error('Erreur:', error);
        alert('Erreur lors de l’ajout de l’aliment.');
    });
}

// Ajout aux favoris
function addToFavorites() {
    const food = {
        name: document.getElementById('food-name').value,
        calories: parseFloat(document.getElementById('food-calories').value),
        proteins: parseFloat(document.getElementById('food-proteins').value),
        carbs: parseFloat(document.getElementById('food-carbs').value),
        fats: parseFloat(document.getElementById('food-fats').value)
    };

    if (!food.name || isNaN(food.calories) || isNaN(food.proteins) || isNaN(food.carbs) || isNaN(food.fats)) {
        alert('Veuillez remplir tous les champs pour ajouter un favori.');
        return;
    }

    if (favorites.some(f => f.name === food.name)) {
        alert('Cet aliment est déjà dans vos favoris.');
        return;
    }

    favorites.push(food);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    updateFavorites();
}

// Mise à jour de la liste des favoris
function updateFavorites() {
    const select = document.getElementById('favorites');
    if (select) {
        select.innerHTML = '<option value="">-- Choisir un favori --</option>';
        favorites.forEach((food, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = food.name;
            select.appendChild(option);
        });
    }
}

// Charger un favori
function loadFavorite() {
  const index = document.getElementById('favorites').value;
  if (index === '') return;
  const food = favorites[index];
  document.getElementById('food-name').value = food.name;
  document.getElementById('food-calories').value = food.calories;
  document.getElementById('food-proteins').value = food.proteins;
  document.getElementById('food-carbs').value = food.carbs;
  document.getElementById('food-fats').value = food.fats;
}

// Mise à jour des suggestions (autocomplétion)
function updateSuggestions() {
  const datalist = document.getElementById('food-suggestions');
  if (datalist) {
      datalist.innerHTML = '';
      recentFoods.forEach(food => {
          const option = document.createElement('option');
          option.value = food.name;
          datalist.appendChild(option);
      });
  }

  const foodInput = document.getElementById('food-name');
  if (foodInput) {
      foodInput.removeEventListener('input', handleFoodInput);
      foodInput.addEventListener('input', handleFoodInput);
  }
}

function handleFoodInput() {
  const food = recentFoods.find(f => f.name.toLowerCase() === this.value.toLowerCase());
  if (food) {
      document.getElementById('food-calories').value = food.calories;
      document.getElementById('food-proteins').value = food.proteins;
      document.getElementById('food-carbs').value = food.carbs;
      document.getElementById('food-fats').value = food.fats;
  }
}

// Ajout d’eau
function addWater(amount) {
  if (!userId) {
      alert('Veuillez soumettre votre profil d’abord.');
      return;
  }

  const waterAmount = parseFloat(amount) * 10; // Conversion cl en ml (25 cl = 250 ml, 750 cl = 7500 ml)
  if (isNaN(waterAmount) || waterAmount <= 0) {
      alert('Quantité d’eau invalide.');
      return;
  }

  const data = { user_id: userId, quantity: waterAmount };
  fetch('/add_water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
  })
  .then(response => {
      if (!response.ok) throw new Error('Erreur lors de l’ajout d’eau');
      console.log("Eau ajoutée:", waterAmount);
      document.getElementById('custom-water').value = '';
      updateData();
      document.getElementById('water-progress').classList.add('added-feedback');
      setTimeout(() => document.getElementById('water-progress').classList.remove('added-feedback'), 500);
  })
  .catch(error => {
      console.error('Erreur:', error);
      alert('Erreur lors de l’ajout d’eau.');
  });
}

// Suppression d’un aliment
function deleteFood(foodId) {
  if (!userId) return;

  fetch('/delete_food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, food_id: foodId })
  })
  .then(response => {
      if (!response.ok) throw new Error('Erreur lors de la suppression');
      console.log("Aliment supprimé:", foodId);
      updateData();
  })
  .catch(error => {
      console.error('Erreur:', error);
      alert('Erreur lors de la suppression.');
  });
}

// Mise à jour des données affichées
function updateData() {
  if (!userId) return;

  fetch(`/get_data/${userId}`)
  .then(response => {
      if (!response.ok) throw new Error('Erreur lors de la récupération des données');
      return response.json();
  })




  .then(data => {
      console.log("Données récupérées:", data);

      // Tableau des aliments
      const tbody = document.querySelector('#food-table tbody');
      if (tbody) {
          tbody.innerHTML = '';
          let totalCalories = 0, totalProteins = 0, totalCarbs = 0, totalFats = 0;
          data.food.forEach(food => {
              const row = document.createElement('tr');
              row.innerHTML = `
                  <td>${food[2]}</td>
                  <td>${food[3].toFixed(1)}g</td>
                  <td>${food[4].toFixed(0)} kcal</td>
                  <td>${food[5].toFixed(1)}g</td>
                  <td>${food[6].toFixed(1)}g</td>
                  <td>${food[7].toFixed(1)}g</td>
                  <td><button onclick="deleteFood(${food[0]})"><i class="fas fa-trash"></i></button></td>
              `;
              tbody.appendChild(row);
              totalCalories += food[4];
              totalProteins += food[5];
              totalCarbs += food[6];
              totalFats += food[7];
          });

          // Mise à jour du dashboard (un seul affichage "x/objectif")
          document.getElementById('calories-remaining').textContent = `${totalCalories.toFixed(0)}/${calorieGoal.toFixed(0)}`;
          document.getElementById('proteins-remaining').textContent = `${totalProteins.toFixed(0)}/${macrosGoal.proteins.toFixed(0)}`;
          document.getElementById('carbs-remaining').textContent = `${totalCarbs.toFixed(0)}/${macrosGoal.carbs.toFixed(0)}`;
          document.getElementById('fats-remaining').textContent = `${totalFats.toFixed(0)}/${macrosGoal.fats.toFixed(0)}`;

          updateStatus('calories', calorieGoal - totalCalories, calorieGoal);
          updateStatus('proteins', macrosGoal.proteins - totalProteins, macrosGoal.proteins);
          updateStatus('carbs', macrosGoal.carbs - totalCarbs, macrosGoal.carbs);
          updateStatus('fats', macrosGoal.fats - totalFats, macrosGoal.fats);
      }

      // Mise à jour de l’eau
      const waterTotal = data.water / 1000;
      const waterRemaining = (waterGoal / 1000) - waterTotal;
      document.getElementById('water-total').textContent = waterTotal.toFixed(1);
      document.getElementById('water-remaining').textContent = waterRemaining.toFixed(1);
      const progress = (data.water / waterGoal) * 100;
      document.getElementById('water-progress').style.width = `${Math.min(progress, 100)}%`;
      document.getElementById('water-reminder').textContent = waterRemaining > 0 ? `Il te reste ${waterRemaining.toFixed(1)} L à boire aujourd’hui 💧` : 'Super, objectif eau atteint ! 🎉';
  })
  .catch(error => {
      console.error('Erreur:', error);
      alert('Erreur lors de la mise à jour des données.');
  });
}

// Mise à jour des indicateurs de statut
function updateStatus(type, remaining, goal) {
  const status = document.getElementById(`${type}-status`);
  if (status) {
      status.classList.remove('status-green', 'status-orange', 'status-red');
      if (remaining > goal * 0.2) status.classList.add('status-green');
      else if (remaining >= 0) status.classList.add('status-orange');
      else status.classList.add('status-red');
  }
}

// Stockage local pour les progrès (simulation, à remplacer par un backend)
let progressData = JSON.parse(localStorage.getItem('progressData')) || [];

// Ajouter une mesure
function addProgress() {
    const date = document.getElementById('progress-date').value;
    const weight = parseFloat(document.getElementById('progress-weight').value);
    const waist = parseFloat(document.getElementById('progress-waist').value) || null;

    if (!date || isNaN(weight)) {
        alert('Veuillez entrer une date et un poids valide.');
        return;
    }

    const height = parseFloat(document.getElementById('height').value) / 100; // Récupéré du profil, en mètres
    const bmi = height ? (weight / (height * height)).toFixed(1) : null;

    const newEntry = { date, weight, bmi, waist };
    progressData.push(newEntry);
    progressData.sort((a, b) => new Date(a.date) - new Date(b.date)); // Trier par date
    localStorage.setItem('progressData', JSON.stringify(progressData));

    document.getElementById('progress-date').value = '';
    document.getElementById('progress-weight').value = '';
    document.getElementById('progress-waist').value = '';

    updateProgressChart();
}

// Mettre à jour le graphique
function updateProgressChart() {
    const ctx = document.getElementById('progress-chart')?.getContext('2d');
    if (!ctx) return;

    if (window.progressChart) window.progressChart.destroy(); // Réinitialiser si existe

    const dates = progressData.map(entry => entry.date);
    const weights = progressData.map(entry => entry.weight);
    const bmis = progressData.map(entry => entry.bmi);
    const waists = progressData.map(entry => entry.waist);

    window.progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Poids (kg)',
                    data: weights,
                    borderColor: '#ff6384',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'IMC',
                    data: bmis,
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Tour de taille (cm)',
                    data: waists,
                    borderColor: '#ffce56',
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Date' } },
                y: { beginAtZero: false, title: { display: true, text: 'Valeur' } }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// Initialiser le graphique au chargement
document.addEventListener('DOMContentLoaded', function() {
    updateProgressChart(); // Charger les données existantes
});
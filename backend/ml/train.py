# -*- coding: utf-8 -*-
"""
Training script for Dyslexia detection using Random Forest.
Author: Nabanshu Barman
Date: 2025-09-29
"""

import os
import pickle
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)
from sklearn.pipeline import Pipeline

# =======================
# Load Dataset
# =======================
DATA_PATH = r"D:\dataset_Readapt\labeled_dysx.csv"  # Change if needed
data = pd.read_csv(DATA_PATH)

# Features and labels
X = data.drop(columns=['Label'])
y = data['Label']

# =======================
# Train-Test Split
# =======================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# =======================
# Pipeline with Scaler + Model
# =======================
pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('rf', RandomForestClassifier(random_state=0))
])

param_grid = {
    'rf__n_estimators': [10, 100, 500, 1000]
}

grid_search = GridSearchCV(
    estimator=pipeline,
    param_grid=param_grid,
    scoring='f1_macro',
    cv=5,
    n_jobs=-1
)
grid_search.fit(X_train, y_train)

print("Best Parameters:", grid_search.best_params_)

# =======================
# Evaluation
# =======================
y_pred = grid_search.predict(X_test)

print("\nModel Performance Metrics:")
print("Accuracy:", accuracy_score(y_test, y_pred))
print("Precision (macro):", precision_score(y_test, y_pred, average='macro'))
print("Recall (macro):", recall_score(y_test, y_pred, average='macro'))
print("F1 Score (macro):", f1_score(y_test, y_pred, average='macro'))

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# Confusion Matrix
cm = confusion_matrix(y_test, y_pred)
plt.figure(figsize=(6, 4))
sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    cmap="Blues",
    xticklabels=np.unique(y),
    yticklabels=np.unique(y)
)
plt.title("Confusion Matrix")
plt.xlabel("Predicted")
plt.ylabel("True")
plt.show()

# =======================
# Save Model
# =======================
SAVE_DIR = "backend/ml"
os.makedirs(SAVE_DIR, exist_ok=True)

model_path = os.path.join(SAVE_DIR, "model.pkl")
with open(model_path, "wb") as f:
    pickle.dump(grid_search, f)

print(f"Model saved to {model_path}")

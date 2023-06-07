import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.optimize import curve_fit
import json

with open('convexes/0.json', 'r') as f:
    data = json.load(f)

x_data = np.array([point["bitrate"] for point in data])
y_data = np.array([point["vmaf"] for point in data])

plt.scatter(x_data, y_data, label='data')
plt.show()
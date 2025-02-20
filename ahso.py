import numpy as np
import random

def initialize_population(pop_size, num_signals):
    return np.random.randint(30, 140, size=(pop_size, num_signals))

def fitness_function(solution, traffic_data):
    delay = np.sum(solution / traffic_data)
    return 1 / (1 + delay)

def selection(population, fitness_scores):
    idx = np.argsort(fitness_scores)[-len(population)//2:]
    return population[idx]

def crossover(parent1, parent2):
    point = random.randint(1, len(parent1) - 1)
    return np.concatenate((parent1[:point], parent2[point:]))

def mutation(solution, mutation_rate=0.1):
    if random.random() < mutation_rate:
        idx = random.randint(0, len(solution) - 1)
        solution[idx] = random.randint(30, 140)
    return solution

def optimize_traffic_signals(traffic_data, generations=100, pop_size=50):
    num_signals = traffic_data.shape[1]
    population = initialize_population(pop_size, num_signals)
    
    for _ in range(generations):
        fitness_scores = np.array([fitness_function(sol, traffic_data) for sol in population])
        selected = selection(population, fitness_scores)
        next_generation = []
        
        for i in range(0, len(selected), 2):
            if i + 1 < len(selected):
                child = crossover(selected[i], selected[i+1])
                child = mutation(child)
                next_generation.append(child)
        
        population = np.array(next_generation)
    
    best_solution = population[np.argmax([fitness_function(sol, traffic_data) for sol in population])]
    return best_solution

# Example usage with dummy traffic data
traffic_data = np.random.randint(10, 100, size=(50, 4))
best_signal_timings = optimize_traffic_signals(traffic_data)
print("Optimized Signal Timings:", best_signal_timings)

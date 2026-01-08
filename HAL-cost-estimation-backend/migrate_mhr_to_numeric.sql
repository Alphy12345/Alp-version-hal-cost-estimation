-- Migration script to update MHR table fields from string to numeric types
-- This should be run manually on the database

-- Update investment_cost from VARCHAR to FLOAT
ALTER TABLE mhr ALTER COLUMN investment_cost TYPE FLOAT;

-- Update elect_power_rating from VARCHAR to FLOAT  
ALTER TABLE mhr ALTER COLUMN elect_power_rating TYPE FLOAT;

-- Update elect_power_charges from VARCHAR to FLOAT
ALTER TABLE mhr ALTER COLUMN elect_power_charges TYPE FLOAT;

-- Update available_hrs_per_annum from VARCHAR to FLOAT
ALTER TABLE mhr ALTER COLUMN available_hrs_per_annum TYPE FLOAT;

-- Update utilization_hrs_year from VARCHAR to FLOAT
ALTER TABLE mhr ALTER COLUMN utilization_hrs_year TYPE FLOAT;

-- Update machine_hr_rate from VARCHAR to FLOAT
ALTER TABLE mhr ALTER COLUMN machine_hr_rate TYPE FLOAT;

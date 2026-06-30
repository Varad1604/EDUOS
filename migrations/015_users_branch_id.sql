ALTER TABLE users
ADD COLUMN branch_id UUID REFERENCES branches(branch_id);

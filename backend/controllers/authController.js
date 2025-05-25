const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // Placeholder for now, will install later

const usersFilePath = path.join(__dirname, '../data/users.json');

// Helper function to read users
const readUsers = async () => {
    try {
        const data = await fs.readFile(usersFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist or is empty, return empty array
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
};

// Helper function to write users
const writeUsers = async (users) => {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
};

exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        const users = await readUsers();

        // Check if username is already taken
        if (users.some(user => user.username === username)) {
            return res.status(409).json({ message: 'Username already taken.' });
        }

        // Generate unique ID
        const userId = uuidv4(); // Using uuid

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create new user object
        const newUser = {
            id: userId,
            username,
            passwordHash,
            instance_id: null,
            access_token: null,
            approved: false,
            expiryDate: null,
            roles: ['user']
        };

        users.push(newUser);
        await writeUsers(users);

        // Return success message (or new user object without password hash)
        const { passwordHash: _, ...userWithoutPassword } = newUser; // Exclude passwordHash
        res.status(201).json({ message: 'User registered successfully.', user: userWithoutPassword });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
};

// --- Login ---
const JWT_SECRET = 'your-very-secret-and-complex-key-for-now'; // TODO: Move to env variable or config

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        const users = await readUsers();

        // Find user by username
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' }); // User not found
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' }); // Incorrect password
        }

        // Generate JWT
        const payload = {
            id: user.id,
            username: user.username,
            roles: user.roles
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

        res.status(200).json({ message: 'Login successful.', token: token });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

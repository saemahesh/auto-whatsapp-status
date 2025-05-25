const fs = require('fs').promises;
const path = require('path');

const usersFilePath = path.join(__dirname, '../data/users.json');

// Helper function to read users (can be refactored into a shared module later)
const readUsers = async () => {
    try {
        const data = await fs.readFile(usersFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

// Helper function to write users (can be refactored into a shared module later)
const writeUsers = async (users) => {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
};

exports.updateSettings = async (req, res) => {
    try {
        const userId = req.user.id; // Get user ID from token (populated by authMiddleware)
        const { instance_id, access_token } = req.body;

        // Basic validation
        if (instance_id === undefined || access_token === undefined) {
            return res.status(400).json({ message: 'Both instance_id and access_token are required in the request body.' });
        }
        
        // Ensure they are strings or null
        if (instance_id !== null && typeof instance_id !== 'string') {
            return res.status(400).json({ message: 'instance_id must be a string or null.' });
        }
        if (access_token !== null && typeof access_token !== 'string') {
            return res.status(400).json({ message: 'access_token must be a string or null.' });
        }


        const users = await readUsers();
        const userIndex = users.findIndex(user => user.id === userId);

        if (userIndex === -1) {
            // This case should ideally not happen if the token is valid and user exists
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update user settings
        users[userIndex].instance_id = instance_id;
        users[userIndex].access_token = access_token;
        // Potentially update a lastModified field if you have one
        // users[userIndex].lastModified = new Date().toISOString();


        await writeUsers(users);

        // Exclude sensitive information before sending back the user
        const { passwordHash, ...updatedUserWithoutPassword } = users[userIndex];

        res.status(200).json({ 
            message: 'Settings updated successfully.', 
            user: updatedUserWithoutPassword 
        });

    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Server error while updating settings.' });
    }
};

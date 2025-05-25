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

exports.listUsers = async (req, res) => {
    try {
        const users = await readUsers();

        // Remove password hashes and other sensitive info if necessary
        const usersForAdmin = users.map(user => {
            const { passwordHash, ...userWithoutPasswordHash } = user;
            // Potentially remove other fields like access_token if admins shouldn't see them directly
            return userWithoutPasswordHash;
        });

        res.status(200).json(usersForAdmin);

    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ message: 'Server error while listing users.' });
    }
};

// Helper function to write users (can be refactored into a shared module later)
const writeUsers = async (users) => {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
};

exports.approveUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const users = await readUsers();

        const userIndex = users.findIndex(user => user.id === userId);

        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Check if user is already approved
        if (users[userIndex].approved) {
            // Optionally, you can send a different message or just return the user
            // For now, we'll just update and return.
        }

        users[userIndex].approved = true;
        // Optionally, you could set an approvalDate or clear an expiryDate if relevant
        // users[userIndex].approvalDate = new Date().toISOString();

        await writeUsers(users);

        const { passwordHash, ...updatedUser } = users[userIndex];
        res.status(200).json({ message: 'User approved successfully.', user: updatedUser });

    } catch (error) {
        console.error('Error approving user:', error);
        res.status(500).json({ message: 'Server error while approving user.' });
    }
};

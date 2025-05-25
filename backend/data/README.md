## `users.json` Structure

The `users.json` file stores an array of user objects. Each user object will have the following structure:

```json
{
  "id": "uuid_string",
  "username": "string",
  "passwordHash": "hashed_string",
  "instance_id": "string_or_null",
  "access_token": "string_or_null",
  "approved": false,
  "expiryDate": "ISO_date_string_or_null",
  "roles": ["user"] // or ["admin"]
}
```

### Field Descriptions:

*   **id**: A unique identifier for the user (e.g., UUID).
*   **username**: The username for the user. Must be unique.
*   **passwordHash**: The hashed password for the user.
*   **instance_id**: An identifier for a linked instance (e.g., a WhatsApp instance), can be null if not linked.
*   **access_token**: An access token for the linked instance, can be null.
*   **approved**: A boolean indicating whether the user's access to the instance is approved by an admin. Defaults to `false`.
*   **expiryDate**: An ISO date string indicating when the user's access expires. Can be null for non-expiring access.
*   **roles**: An array of strings defining the user's roles. Can be `["user"]` or `["admin"]`.

The `users.json` file itself is initialized as an empty array `[]`. Users will be added to this array as they are created.

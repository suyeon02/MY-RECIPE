# Firebase setup for MY RECIPE

Recipes are loaded from and saved to the public Firestore collection `publicRecipes`. No login or account is used. As approved, this collection is public: anyone can read, add, change, or delete its recipes. Use this only for non-sensitive recipe data. Browser data-URL photos stay in local storage and are not shared to Firebase.

## Firebase Console setup

1. Open project `my-recipe-3008f` in the [Firebase Console](https://console.firebase.google.com/).
2. In **Firestore Database**, create a database if one does not already exist.
3. In **Firestore → Rules**, publish the contents of [`firestore.rules`](./firestore.rules).
4. Rebuild and publish the updated app. On first open, local recipes seed the cloud collection if it is empty. Later opens load the shared list automatically.

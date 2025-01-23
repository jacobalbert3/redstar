export const getUserIdFromToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    // Decode the token (JWT is split into three parts by dots)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId;
  } catch (error) {
    console.error('Error getting user ID from token:', error);
    return null;
  }
};

export const getUserEmailFromToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email;
  } catch (error) {
    console.error('Error getting user email from token:', error);
    return null;
  }
}; 
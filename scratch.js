const UserRole = {
  CLIENT: 'CLIENT',
  PROVIDER: 'PROVIDER',
  ADMIN: 'ADMIN'
};

const role = UserRole.PROVIDER;
const insertedRole = role === UserRole.PROVIDER ? UserRole.CLIENT : (role || UserRole.PROVIDER);
console.log({
  role,
  insertedRole,
  isEqual: role === UserRole.PROVIDER
});

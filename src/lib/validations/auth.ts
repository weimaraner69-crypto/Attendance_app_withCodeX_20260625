export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('パスワードは8文字以上である必要があります');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('大文字を1文字以上含める必要があります');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('小文字を1文字以上含める必要があります');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('数字を1文字以上含める必要があります');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateName(name: string): boolean {
  return name.trim().length >= 2;
}

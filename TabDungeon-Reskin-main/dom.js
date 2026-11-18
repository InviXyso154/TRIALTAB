export function createInput(value, placeholder, type = 'text', className = '') {
  const element = document.createElement('input');
  element.type = type;
  element.value = value || '';
  element.placeholder = placeholder;
  element.className = className;
  return element;
}

export function createButton(label, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  return element;
}

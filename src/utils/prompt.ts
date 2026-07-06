import inquirer from 'inquirer';

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { result } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'result',
      message,
      default: defaultValue,
    },
  ]);
  return result;
}

export async function select<T = string>(message: string, choices: Array<{ name: string; value: T }>): Promise<T> {
  const { result } = await inquirer.prompt([
    {
      type: 'select',
      name: 'result',
      message,
      choices,
    },
  ]);
  return result;
}

export async function input(message: string, defaultValue?: string): Promise<string> {
  const { result } = await inquirer.prompt([
    {
      type: 'input',
      name: 'result',
      message,
      default: defaultValue,
    },
  ]);
  return result;
}

export async function password(message: string): Promise<string> {
  const { result } = await inquirer.prompt([
    {
      type: 'password',
      name: 'result',
      message,
      mask: '*',
    },
  ]);
  return result;
}

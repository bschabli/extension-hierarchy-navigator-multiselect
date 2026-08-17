import { resolveInterfaceLocale, translate } from './I18n';

function assert(condition: boolean, message: string): void {
    if(!condition) { throw new Error(message); }
}

assert(resolveInterfaceLocale('de-de', 'en-US')==='de', 'Tableau German locale should select German.');
assert(resolveInterfaceLocale('en-us', 'de-DE')==='en', 'Tableau locale should take precedence over the browser.');
assert(resolveInterfaceLocale(undefined, 'de-AT')==='de', 'Browser German locale should select German.');
assert(resolveInterfaceLocale('de-de', 'de-DE', '?lang=en')==='en', 'URL override should select English.');
assert(resolveInterfaceLocale('fr-fr', 'fr-FR')==='en', 'Unsupported locales should fall back to English.');
assert(
    translate('de', '{count} values selected', { count: 3 })==='3 Werte ausgewählt',
    'German translations should interpolate values.'
);
assert(translate('en', 'Select all')==='Select all', 'English should use the source interface text.');
assert(translate('de', 'Unknown fallback')==='Unknown fallback', 'Missing translations should fall back safely.');
console.log('Localization acceptance tests passed.');

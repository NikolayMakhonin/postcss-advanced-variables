// tooling
import { list } from 'postcss';
import getClosestVariable from './get-closest-variable';
import getReplacedString from './get-replaced-string';
import manageUnresolved from './manage-unresolved';
import setVariable from './set-variable';
import transformNode from './transform-node';

// transform @include at-rules
export default function transformIncludeAtrule(rule, opts) {
	// if @include is supported
	if (opts.transform.includes('@include')) {
		// @include options
		const { name, args } = getIncludeOpts(rule);

		// the closest @mixin variable
		const mixin = getClosestVariable(`@mixin ${name}`, rule.parent, opts);

		// if the @mixin variable exists
		if (mixin) {
			// set @mixin variables on the @include at-rule
			for (const argName in args) {
				if (Object.prototype.hasOwnProperty.call(args, argName)) {
          const index = Number(argName)
					if (!(
            index >= 0 && index < mixin.params.length
            || mixin.params.some(param => param.name === argName)
          )) {
						throw rule.error(`The mixin "${name}" does not have a parameter named "${argName}"`);
					}
				}
			}

			mixin.params.forEach(
				(param, index) => {
					const arg = index in args ? getReplacedString(args[index], rule, opts)
						: param.name in args ? getReplacedString(args[param.name], rule, opts)
						: param.value;

					setVariable(rule, param.name, arg, opts);
				}
			);

			// clone the @mixin at-rule
			const clone = mixin.rule.clone({
				original:  rule,
				parent:    rule.parent,
				variables: rule.variables
			});

			// transform the clone children
			return transformNode(clone, opts).then(() => {
				// replace the @include at-rule with the clone children
				rule.parent.insertBefore(rule, clone.nodes);

				rule.remove();
			})
		} else {
			// otherwise, if the @mixin variable does not exist
			manageUnresolved(rule, opts, name, `Could not resolve the mixin for "${name}"`);
		}
	}
}

// return the @include statement options (@include NAME, @include NAME(ARGS))
const getIncludeOpts = node => {
	// @include name and args
  let parenIndex = node.params.indexOf(matchOpeningParen);
  let name, sourceArgs
	if (parenIndex >= 0) {
		name = node.params.substring(0, parenIndex)
		sourceArgs = node.params.substring(parenIndex + 1, node.params.length - 1)
	} else {
		name = node.params
		sourceArgs = null
	}

	const args = sourceArgs
		? list.comma(sourceArgs.slice(0))
      .reduce((acc, arg, index) => {
        const nameValue = arg.startsWith('$')
					? list.split(arg, [':'], true)
					: null
				if (nameValue?.length >= 2) {
					acc[nameValue[0].substring(1)] = nameValue[1]
				} else {
					acc[index] = arg
				}
        return acc
      }, {})
		: [];

	return { name, args };
};

// match an opening parenthesis
const matchOpeningParen = '(';

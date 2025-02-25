import ts from "typescript";
import { NodeParser } from "../NodeParser";
import { Context } from "../NodeParser";
import { SubNodeParser } from "../SubNodeParser";
import { ObjectProperty, ObjectType } from "../Type/ObjectType";
import { getKey } from "../Utils/nodeKey";
import { DefinitionType } from "../Type/DefinitionType";

/**
 * This function parser supports both `FunctionDeclaration` & `ArrowFunction` nodes.
 * This parser will only parse the input parameters.
 * TODO: Parse `ReturnType` of the function?
 */
export class FunctionParser implements SubNodeParser {
    constructor(protected childNodeParser: NodeParser) {}

    public supportsNode(node: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration): boolean {
        if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
            // Functions needs a name for us to include it in the json schema
            return Boolean(node.name);
        }
        // We can figure out the name of arrow functions if their parent is a variable declaration
        return (
            (node.kind === ts.SyntaxKind.ArrowFunction || node.kind === ts.SyntaxKind.FunctionExpression) &&
            ts.isVariableDeclaration(node.parent)
        );
    }
    public createType(node: ts.FunctionDeclaration | ts.ArrowFunction | ts.MethodDeclaration, context: Context): DefinitionType {
        return new DefinitionType(this.getTypeName(node), this.createNamedArguments(node, context));
    }

    public createTypeAsObjectProperty(node: ts.FunctionDeclaration | ts.ArrowFunction | ts.MethodDeclaration, context: Context): ObjectProperty {
        return new ObjectProperty(this.getTypeName(node), this.createNamedArguments(node, context), !node.questionToken)
    }

    protected createNamedArguments(node: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression | ts.MethodDeclaration, context: Context): ObjectType {
        const parameterTypes = node.parameters.map((parameter) => {
            return this.childNodeParser.createType(parameter, context);
        });

        return new ObjectType(
            `object-${getKey(node, context)}`,
            [],
            parameterTypes.map((parameterType, index) => {
                // If it's missing a questionToken but has an initializer we can consider the property as not required
                const required = node.parameters[index].questionToken ? false : !node.parameters[index].initializer;

                return new ObjectProperty(node.parameters[index].name.getText(), parameterType, required);
            }),
            false
        );
    }

    public getTypeName(node: ts.FunctionDeclaration | ts.ArrowFunction | ts.MethodDeclaration): string {
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
            const parent = node.parent;
            if (ts.isVariableDeclaration(parent)) {
                return `NamedParameters<typeof ${parent.name.getText()}>`;
            }
        }
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
            return `NamedParameters<typeof ${node.name!.getText()}>`;
        }
        throw new Error("Expected to find a name for function but couldn't");
    }
}

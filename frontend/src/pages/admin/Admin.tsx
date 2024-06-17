import React, { ReactNode } from "react";
import { PrimaryButton, IconButton } from "@fluentui/react";
import { Announced } from "@fluentui/react/lib/Announced";
import { TextField, ITextFieldStyles } from "@fluentui/react/lib/TextField";
import { DetailsList, DetailsListLayoutMode, Selection, IColumn } from "@fluentui/react/lib/DetailsList";
import { MarqueeSelection } from "@fluentui/react/lib/MarqueeSelection";
import { mergeStyles } from "@fluentui/react/lib/Styling";

import styles from "./Admin.module.css";

const exampleChildClass = mergeStyles({
    display: "block",
    marginBottom: "10px"
});

const textFieldStyles: Partial<ITextFieldStyles> = { root: { maxWidth: "300px" } };

export interface IUserListItem {
    key: number;
    name: string;
    email: string;
    role: string;
    actions: ReactNode;
    value: number;
}

export interface IUserListState {
    items: IUserListItem[];
    selectionDetails: string;
}

export class UserList extends React.Component<{}, IUserListState> {
    private _selection: Selection;
    private _allItems: IUserListItem[];
    private _columns: IColumn[];
    

    constructor(props: {}) {
        super(props);

        this._selection = new Selection({
            onSelectionChanged: () => this.setState({ selectionDetails: this._getSelectionDetails() })
        });

        // Populate with items for demos.
        this._allItems = [];
        for (let i = 0; i < 10; i++) {
            this._allItems.push({
                key: i,
                name: "User " + i,
                email: "example@mail.com",
                role: "User",
                actions: actions({}),
                value: i
            });
        }

        this._columns = [
            { key: "column1", name: "Name", fieldName: "name", minWidth: 100, maxWidth: 200, isResizable: true },
            { key: "column2", name: "Email", fieldName: "email", minWidth: 100, maxWidth: 200, isResizable: true },
            { key: "column3", name: "Role", fieldName: "role", minWidth: 100, maxWidth: 200, isResizable: true },
            { key: "column4", name: "Actions", fieldName: "actions", minWidth: 300, maxWidth: 400, isResizable: true }
        ];

        this.state = {
            items: this._allItems,
            selectionDetails: this._getSelectionDetails()
        };
    }

    public render(): JSX.Element {
        const { items, selectionDetails } = this.state;

        return (
            <div>
                <div className={exampleChildClass}>{selectionDetails}</div>
                <Announced message={selectionDetails} />
                <TextField className={exampleChildClass} label="Filter by name:" onChange={this._onFilter} styles={textFieldStyles} />
                <Announced message={`Number of items after filter applied: ${items.length}.`} />
                <MarqueeSelection selection={this._selection}>
                    <DetailsList
                        items={items}
                        columns={this._columns}
                        setKey="set"
                        layoutMode={DetailsListLayoutMode.justified}
                        selection={this._selection}
                        selectionPreservedOnEmptyClick={true}
                        ariaLabelForSelectionColumn="Toggle selection"
                        ariaLabelForSelectAllCheckbox="Toggle selection for all items"
                        checkButtonAriaLabel="select row"
                        onItemInvoked={this._onItemInvoked}
                    />
                </MarqueeSelection>
            </div>
        );
    }

    private _getSelectionDetails(): string {
        const selectionCount = this._selection.getSelectedCount();

        switch (selectionCount) {
            case 0:
                return "No items selected";
            case 1:
                return "1 item selected: " + (this._selection.getSelection()[0] as IUserListItem).name;
            default:
                return `${selectionCount} items selected`;
        }
    }

    private _onFilter = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, text: string | undefined): void => {
        this.setState({
            items: text ? this._allItems.filter(i => i.name.toLowerCase().indexOf(text.toLowerCase()) > -1) : this._allItems
        });
    };

    private _onItemInvoked = (item: IUserListItem): void => {
        alert(`Item invoked: ${item.name}`);
    };
}
const iconStyle = {
    icon: { color: "black" },
    root: {
        selectors: {
            ":hover .ms-Button-icon": {
                color: "rgb(0, 120, 212);"
            }
        }
    }
};

const actions: React.FC = () => {
    return (
        <div>
            <IconButton styles={iconStyle} iconProps={{ iconName: "Chart" }} title="Show thought process" ariaLabel="Show thought process" onClick={() => {}} />
            <IconButton
                styles={iconStyle}
                iconProps={{ iconName: "Settings" }}
                title="Show thought process"
                ariaLabel="Show thought process"
                onClick={() => {}}
            />
            <IconButton
                styles={iconStyle}
                iconProps={{ iconName: "Delete" }}
                title="Show thought process"
                ariaLabel="Show thought process"
                onClick={() => {}}
            />
        </div>
    );
};

const Admin: React.FC = () => {
    return (
        <div className={styles.page_container}>
            <div id="options-row" className={styles.row}>
                <h1>Roles and access</h1>
                <PrimaryButton className={styles.option} text="Invite user" />
            </div>
            <div>
                <UserList />
            </div>
        </div>
    );
};

export default Admin;

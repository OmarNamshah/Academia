// Copyright (c) 2024, SanU and contributors
// For license information, please see license.txt

let mustInclude = [];

var global_print_papaer = null;
var global_is_received = null;
var global_action_name = null;
var global_recipient_docname = null;
let global_applicant_company = null;
let global_recipient_designation = null;
let global_next_recipient = null;
let global_current_employee = null;

frappe.ui.form.on("Transaction", {
	setup: function (frm) {
		// Changing Button Style
		$(`<style>
      .btn[data-fieldname="get_recipients"] {
        background-color: #171717; /* Custom dark gray */
        color: white;
      }
      .btn[data-fieldname="get_recipients"]:hover {
        background-color: #171710 !important;/* Slightly darker gray for interaction states */
        color: white !important;
      }

      .btn[data-fieldname="refresh_button"] {
        background-color: #171717; /* Custom dark gray */
        color: white;
      }
      .btn[data-fieldname="refresh_button"]:hover {
        background-color: #171710 !important;/* Slightly darker gray for interaction states */
        color: white !important;
      }
        </style>`).appendTo("head");
	},

	onload: function (frm) {
		if (frm.doc.docstatus === 1) {
			if (frm.doc.status === "Completed") {
				$(".btn-secondary")
					.filter(function () {
						return $(this).text().trim() === "Cancel";
					})
					.hide();
			}

			frappe.call({
				method: "academia.transaction_management.doctype.transaction.transaction.is_there_approve_or_reject_acions",
				args: {
					docname: frm.doc.name,
				},
				callback: function (r) {
					if (r.message) {
						if (r.message) {
							$(".btn-secondary")
								.filter(function () {
									return $(this).text().trim() === "Cancel";
								})
								.hide();
						}
					}
				},
			});
		}

		if (frm.doc.docstatus === 0) {
			global_print_papaer = null;
			global_is_received = null;
			global_action_name = null;
			global_recipient_docname = null;

			frm.set_value("status", "Pending");

			// if user is admin ignore bcoz he cant be employee
			if (frappe.session.user !== "Administrator") {
				// Fetch the current employee's document only if the docstatus is draft
				frappe.call({
					method: "frappe.client.get_value",
					args: {
						doctype: "User",
						filters: { name: frappe.session.user },
						fieldname: "email",
					},
					callback: function (response) {
						if (response.message && response.message.email) {
							var userEmail = response.message.email;

							frappe.call({
								method: "frappe.client.get",
								args: {
									doctype: "Employee",
									filters: { user_id: userEmail },
								},
								callback: function (response) {
									if (response.message) {
										var employee = response.message;
										// Set the default value of the department field to the current employee's department
										frm.set_value("department", employee.department);
										frm.set_value("designation", employee.designation);
										// You can access other fields of the employee document as well
										// Example: frm.set_value('employee_name', employee.employee_name);
									}
								},
							});
						}
					},
				});
			}
		}
	},

	refresh: function (frm) {
		global_print_papaer = null;
		global_is_received = null;
		global_action_name = null;
		global_recipient_docname = null;

		if (!frm.doc.start_with && frappe.session.user != "Administrator") {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Employee",
					filters: { user_id: frappe.session.user },
				},
				callback: (response) => {
					employee = response.message;
					if (employee) {
						frm.set_value("start_with", employee.name);
						frm.set_value("start_with_company", employee.company);
						frm.set_value("start_with_department", employee.department);
						frm.set_value("start_with_designation", employee.designation);
					}
				},
			});
		}

		// Hide 'add row' button
		frm.get_field("recipients").grid.cannot_add_rows = true;
		// Stop 'add below' & 'add above' options
		frm.get_field("recipients").grid.only_sortable();
		frm.refresh_field("recipients");

		// frm.fields_dict.recipients.grid.wrapper.find(".grid-add-row")
		// .toggle(!frm.doc.through_route);

		// // Disable the "Add New" button when through_route is checked
		// frm.fields_dict.recipients.grid.wrapper.find(".grid-add-row")
		//   .prop("disabled", frm.doc.through_route);

		// Disable the "Get Recipients" button when through_route is checked and there is at least one recipient
		frm.set_df_property(
			"get_recipients",
			"hidden",
			frm.doc.through_route && frm.doc.recipients.length > 0
		);
		frm.set_df_property(
			"get_recipients",
			"disabled",
			frm.doc.through_route && frm.doc.recipients.length > 0
		);
		if (frm.doc.docstatus === 1) {
			// Closed Button
			if (frappe.user_roles.includes("Transaction Manager") && frm.doc.status !== "Closed") {
				frm.add_custom_button("Closed", () => {
					const share_name = frm.doc.name;
					console.log("Pressed:", share_name);

					// Call the Python function to get the shared users
					frappe.call({
						method: "academia.transaction_management.doctype.transaction.transaction.update_closed_premissions",
						args: {
							docname: share_name,
						},
						callback: function (r) {
							if (r.message) {
								location.reload();
							}
						},
					});
				});
			}

			if (!frm.doc.__islocal) {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Employee",
						filters: {
							user_id: frappe.session.user,
						},
						fields: ["name"],
					},
					callback: function (r) {
						if (r.message && r.message.length > 0) {
							// Assign the name of the employee document to the global variable
							global_current_employee = r.message[0].name;
						}
					},
				});
				if (frm.doc.recipients.length > 0) {
					frm.doc.recipients.forEach(function (row) {
						if (row.recipient_email === frappe.session.user) {
							if (row.print_paper) {
								global_print_papaer = true;
							}
							if (row.is_received) {
								global_is_received = true;
							}
						}
					});
					frappe.call({
						method: "academia.transaction_management.doctype.transaction.transaction.get_next_recipient_by_step",
						args: {
							transaction_name: frm.doc.name,
							current_employee: frappe.session.user,
						},
						callback: function (r) {
							if (r.message) {
								// Assign the result to the global variable
								global_next_recipient = r.message;
							}
						},
					});
				}

				frappe.call({
					method: "academia.transaction_management.doctype.transaction.transaction.search_in_actions_for_print_paper_user",
					args: {
						transacion_name: frm.doc.name,
						user: frappe.session.user,
						from_company: frm.doc.start_with_company ?? "",
						from_department: frm.doc.start_with_department ?? "",
						from_designation: frm.doc.start_with_designation ?? "",
					},
					callback: function (r) {
						if (r.message) {
							console.log(r.message);
							msg = r.message;
							if (msg[0]) {
								global_action_name = msg[0];
							}

							if (msg[1]) {
								global_print_papaer = true;
								console.log(msg[1]);
							}
							if (msg[2]) {
								global_is_received = true;
								console.log(msg[2]);
							}
							if (msg[3]) {
								console.log("receipent docname:", msg[3]);
								global_recipient_docname = msg[3];
							}

							// After the first method, call the get_user_permissions method
							frappe.call({
								method: "academia.transaction_management.doctype.transaction.transaction.get_user_permissions",
								args: {
									docname: frm.doc.name,
									user: frappe.session.user,
								},
								callback: function (response) {
									var docshare = response.message;
									if (
										docshare &&
										docshare.share === 1 &&
										frm.status != "Closed"
									) {
										console.log("print_paper_checked2: ", global_print_papaer);
										console.log("is_received2: ", global_is_received);

										if (global_print_papaer && !global_is_received) {
											add_received_action(frm);
										} else if (
											(global_print_papaer == true &&
												global_is_received == true) ||
											global_print_papaer == null
										) {
											add_approve_action(frm);
											add_reject_action(frm);
											if (!frm.doc.circular) {
												add_redirect_action(frm);
												if (frappe.user_roles.includes("Council Head")) {
													frappe.call({
														method: "academia.transaction_management.doctype.transaction.transaction.get_last_topic_action",
														args: {
															docname: frm.doc.name,
														},
														callback: function (r) {
															console.log(
																"council action: ",
																r.message
															);
															if (r.message) {
																add_council_action(frm);
															}
														},
													});
												}
											}
										}
									}
								},
							});
						}
					},
				});
			}
		}

		// Set query for category field
		frm.set_query("category", function () {
			return {
				filters: {
					is_group: 1,
				},
			};
		});

		// Set query for sub_category field based on selected category
		frm.fields_dict["sub_category"].get_query = function (doc) {
			return {
				filters: {
					parent_category: doc.category,
				},
			};
		};

		// Filter the External Entity options based on is_group field
		frm.set_query("main_external_entity_from", function () {
			return {
				filters: {
					is_group: 1,
				},
			};
		});

		frm.set_query("main_external_entity_to", function () {
			return {
				filters: {
					is_group: 1,
				},
			};
		});

		frm.set_query("reference_transaction", function () {
			return {
				filters: {
					transaction_scope: "With External Entity",
					type: "Incoming",
					status: "Completed",
				},
			};
		});

		frm.doc.recipients.forEach(function (row) {
			if (frm.doc.full_electronic) {
				frm.doc.recipients.forEach(function (recipient) {
					frm.set_df_property(
						"print_paper",
						"read_only",
						frm.doc.full_electronic,
						row.name
					);
					recipient.print_paper = 0;
				});
			}
		});
	},

	main_external_entity_from: function (frm) {
		var main_entity = frm.doc.main_external_entity_from;
		console.log("here from");
		if (main_entity) {
			frm.set_query("sub_external_entity_from", function () {
				return {
					filters: {
						parent_external_entity: main_entity,
					},
				};
			});

			frm.set_query("external_entity_designation_from", function (doc, cdt, cdn) {
				return {
					filters: {
						external_entity: doc.main_entity,
					},
					ignore_permissions: true,
				};
			});
		} else {
			frm.set_value("sub_external_entity_from", "");
			frm.set_value("external_entity_designation_from", "");
		}
	},

	main_external_entity_to: function (frm) {
		var main_entity = frm.doc.main_external_entity_to;

		console.log("here to");
		if (main_entity) {
			frm.set_query("sub_external_entity_to", function () {
				return {
					filters: {
						parent_external_entity: main_entity,
					},
				};
			});

			frm.set_query("external_entity_designation_to", function (doc, cdt, cdn) {
				return {
					filters: {
						external_entity: main_entity,
					},
				};
			});
		} else {
			frm.set_value("sub_external_entity_to", "");
			frm.set_value("external_entity_designation_to", "");
		}
	},

	through_route: function (frm) {
		if (!frm.doc.sub_category) {
			update_must_include(frm);
		}
		if (frm.doc.through_route) {
			frm.doc.circular = false;
			frm.refresh_field("circular");
		}
		frm.fields_dict.recipients.grid.wrapper
			.find(".grid-add-row")
			.prop("disabled", frm.doc.through_route);

		frm.set_df_property(
			"get_recipients",
			"disabled",
			frm.doc.through_route && frm.doc.recipients.length > 0
		);
	},

	// refresh action html template only when press this button
	refresh_button: function (frm) {
		frappe.call({
			method: "academia.transaction_management.doctype.transaction.transaction.get_actions_html",
			args: {
				transaction_name: frm.doc.name,
			},
			callback: function (r) {
				if (r.message) {
					frm.set_df_property("actions", "options", r.message);
					// console.log(r.message);
				}
			},
		});
	},

	// Validate function
	before_save: function (frm) {
		// Check if any required attachment is missing
		let missing_attachments = [];
		if (frm.doc.attachments && frm.doc.attachments.length > 0) {
			frm.doc.attachments.forEach((attachment) => {
				if (attachment.required && !attachment.file) {
					missing_attachments.push(attachment.attachment_label);
				}
			});
		}

		if (missing_attachments.length > 0) {
			let message = ` Please attach the following required files before saving:\n\n${missing_attachments.join(
				"\n"
			)}`;
			frappe.throw(message);
		}
	},

	// transaction_scope:function(frm){
	//   if (frm.doc.transaction_scope === "Among Companies") {
	//     // Set the 'through_route' field to checked and make it read-only
	//     frm.set_value("through_route", 1);

	//     frm.toggle_display("through_route", true);
	//     frm.toggle_reqd("through_route", true);
	//     frm.toggle_enable("through_route", false);
	//   } else {
	//     // Reset the 'through_route' field and make it editable
	//     frm.set_value("through_route", 0);

	//     frm.toggle_display("through_route", true);
	//     frm.toggle_reqd("through_route", false);
	//     frm.toggle_enable("through_route", true);
	//   }
	// },

	type: function (frm) {
		if (frm.doc.type === "Incoming") {
			// if(frappe.session.user != "Administrator"){
			frappe.call({
				method: "academia.transaction_management.doctype.transaction.transaction.set_company_head",
				args: {
					user_id: frappe.session.user,
					company_of_creator: frm.doc.company,
				},
				callback: function (r) {
					if (r.message) {
						if (r.message) {
							console.log(r.message.head_employee);
							console.log("creation: ", frm.doc.created_by);

							frm.set_value("start_with", r.message.head_employee);
							frm.set_df_property("start_with", "hidden", 1);
							frm.set_df_property("start_from_employee", "hidden", 1);
						}
					}
				},
			});
			frm.toggle_display("through_route", true);
			frm.toggle_reqd("through_route", true);
			frm.toggle_enable("through_route", false);
			// }
			// else{
			//   console.log("It Is The Administrator")
			// }
		} else {
			frm.toggle_display("through_route", true);
			frm.toggle_reqd("through_route", false);
			frm.toggle_enable("through_route", true);
		}
	},

	start_with: function (frm) {
		// if(frm.doc.start_with)
		//   {
		if (!frm.doc.sub_category) {
			update_must_include(frm);
		}
		// }
		// else{
		//   frm.set_value('start_with_company', '');
		//   frm.set_value('start_with_department', '');
		//   frm.set_value('start_with_designation', '');
		// }
	},

	circular: function (frm) {
		if (!frm.doc.sub_category) {
			update_must_include(frm);
		}
		if (frm.doc.circular) {
			frm.doc.through_route = false;
			frm.refresh_field("through_route");
		}
	},

	get_default_template_button: function (frm) {
		if (frm.doc.transaction_description && frm.doc.referenced_document) {
			frappe.confirm(
				__(
					"Are you sure you want to reload opening field?<br>All data in the field will be lost."
				),
				function () {
					get_default_template(frm);
				}
			);
		}
	},

	// Advance Get members Dialog
	get_recipients: function (frm) {
		var all_companies = frm.doc.transaction_scope === "Among Companies";
		var setters = {
			employee_name: null,
			department: null,
			designation: null,
		};

		if (all_companies) {
			setters.company = null;
		}
		let existingRecipients = frm.doc.recipients || [];
		let existingRecipientIds = existingRecipients.map((r) => r.recipient_email);
		// let filterCondition = "not in"
		// let filterValue = existingRecipientIds

		// TODO: also add start_with user_id to the exception
		// Add the current user to the existing recipient IDs
		existingRecipientIds.push(frappe.session.user);

		if (!frm.doc.circular && !frm.doc.sub_category && existingRecipients.length > 0) {
			frappe.msgprint("You can select only one employee.");

			// // Disable the "Get Recipients" button
			// frm.get_field("get_recipients").df.read_only = true;
			// frm.refresh_field("get_recipients");
		} else {
			// Enable the "Get Recipients" button
			frm.get_field("get_recipients").df.read_only = false;
			frm.refresh_field("get_recipients");

			if (mustInclude.length > 0) {
				mustInclude = mustInclude.filter((item) => !existingRecipientIds.includes(item));
				// filterCondition = "in"
				// filterValue = mustInclude
			}
			let d = new frappe.ui.form.MultiSelectDialog({
				doctype: "Employee",
				target: frm,
				setters: setters,

				// add_filters_group: 1,
				date_field: "transaction_date",

				get_query() {
					let filters = {
						docstatus: ["!=", 2],
						department: ["!=", null],
						designation: ["!=", null],
						//user_id: ["in", mustInclude],
					};

					if (!all_companies) {
						filters.company = frm.doc.company;
					}

					return {
						filters: filters,
					};
				},

				primary_action_label: "Get Recipients",
				action(selections) {
					// if the transaction through route you can select only one recipientS
					if (!frm.doc.circular && !frm.doc.sub_category && selections.length > 1) {
						frappe.msgprint("To Select Multi Recipients Make Circular Chickbox ON");
						return;
					}
					// Fetch the selected employees with specific fields
					frappe.call({
						method: "frappe.client.get_list",
						args: {
							doctype: "Employee",
							filters: { name: ["in", selections] },
							fields: [
								"name",
								"employee_name",
								"designation",
								"department",
								"company",
								"user_id",
							],
						},
						callback: (response) => {
							var selectedEmployees = response.message;

							// // Check the value of the 'through_route' field
							// if (frm.doc.through_route) {
							//   // If 'through_route' is checked, only allow one recipient
							//   if (selectedEmployees.length > 1) {
							//     frappe.msgprint("You can only select one recipient when 'Through Route' is checked.");
							//     return;
							//   }
							// }

							// frm.set_value('recipients', []);

							selectedEmployees.forEach((employee) => {
								frm.add_child("recipients", {
									recipient: employee.name, // Use document name instead of employee_name
									recipient_name: employee.employee_name,
									recipient_company: employee.company,
									recipient_department: employee.department,
									recipient_designation: employee.designation,
									recipient_email: employee.user_id,
									// print_paper: !frm.doc.full_electronic
								});
							});

							this.dialog.hide();

							frm.refresh_field("recipients");

							// // Hide the "Add" button for the recipients table if through_route is checked and there's a recipient
							// frm.get_field("recipients").grid.grid_buttons.find(".grid-add-row").toggle(!frm.doc.through_route || existingRecipients.length === 0);
						},
					});
				},
			});
		}
	},

	clear_recipients: function (frm) {
		frm.clear_table("recipients");
		frm.refresh_field("recipients");
	},

	referenced_document: function (frm) {
		get_default_template(frm);
	},

	sub_category: function (frm) {
		get_cateory_doctype(frm);

		// Clear previously added recipient fields
		frm.clear_table("recipients");
		frm.refresh_fields("recipients");

		// Fetch Transaction Type Recipients based on the selected category
		if (frm.doc.sub_category) {
			frappe.call({
				method: "academia.transaction_management.doctype.transaction.transaction.get_transaction_category_recipients",
				args: {
					transaction_category: frm.doc.sub_category,
				},
				callback: function (response) {
					const path = response.message || [];

					path.forEach(function (path1) {
						frm.add_child("path", {
							step: path1.step,
							designation: path1.designation,
							print_paper: path1.print_paper,
							has_sign: path1.has_sign,
							is_received: path1.is_received,
						});
						frm.add_child("recipients", {
							step: path1.step,
							recipient_designation: path1.designation,
							print_paper: path1.print_paper,
							has_sign: path1.has_sign,
							is_received: path1.is_received,
						});
					});
					setTimeout(function () {
						// DO NOT DELETE THIS: This is a workaround to open and close the first row of the recipients grid so that filtering works
						let grid = frm.fields_dict["recipients"].grid;
						if (grid.grid_rows.length > 0) {
							let first_row = grid.grid_rows[0];
							first_row.toggle_view(true); // Open the first row
							setTimeout(function () {
								first_row.toggle_view(false); // Close the first row
							}, 0);
						}
					}, 0);

					global_recipient_designation = path;
					// Refresh the form to display the newly added fields
					frm.refresh_fields("recipients");
					frm.refresh_fields("path");
				},
			});

			// Clear previously added attach image fields
			frm.clear_table("attachments");

			// Fetch Transaction Type Requirements based on the selected Transaction Type
			frappe.call({
				method: "academia.transaction_management.doctype.transaction.transaction.get_transaction_category_requirement",
				args: {
					transaction_category: frm.doc.sub_category,
				},
				callback: function (response) {
					// Add attach image fields for each Transaction Type Requirement
					const requirements = response.message || [];

					requirements.forEach(function (requirement) {
						const fieldname =
							requirement.name.replace(/ /g, "_").toLowerCase() + "_file";
						frm.add_child("attachments", {
							// attachment_name: fieldname,
							attachment_label: requirement.name,
							fieldtype: "Attach Image",
							required: requirement.required,
						});
					});

					// Hide 'add row' button
					frm.get_field("attachments").grid.cannot_add_rows = true;
					// Stop 'add below' & 'add above' options
					frm.get_field("attachments").grid.only_sortable();
					//make the lables uneditable
					frm.fields_dict.attachments.grid.docfields[1].read_only = 1;

					// Refresh the form to display the newly added fields
					frm.refresh_fields("attachments");
				},
			});
		}
	},
});

function add_redirect_action(frm) {
	cur_frm.page.add_action_item(__("Redirect"), function () {
		var is_received = false;
		frm.doc.recipients.forEach(function (recipient) {
			if (recipient.recipient_email === frappe.session.user) {
				if (recipient.print_paper && recipient.is_received) {
					is_received = true;
				}
			}
		});

		frappe.new_doc("Transaction Action", {
			transaction: frm.doc.name,
			type: "Redirected",
			from_company: frm.doc.start_with_company,
			from_department: frm.doc.start_with_department,
			from_designation: frm.doc.start_with_designation,
			received: is_received,
		});
		// back to Transaction after save the transaction action
		frappe.ui.form.on("Transaction Action", {
			on_submit: function () {
				frappe.call({
					method: "academia.transaction_management.doctype.transaction.transaction.update_share_permissions",
					args: {
						docname: frm.doc.name,
						user: frappe.session.user,
						permissions: {
							read: 1,
							write: 0,
							share: 0,
							submit: 0,
						},
					},
					callback: function (response) {
						if (response.message) {
							// back to Transaction after save the transaction action
							frappe.set_route("Form", "Transaction", frm.doc.name);
							location.reload();
						}
					},
				});
			},
		});
	});
}

function add_council_action(frm) {
	cur_frm.page.add_action_item(__("Create Topic"), function () {
		frappe.call({
			method: "academia.transaction_management.doctype.transaction.transaction.create_new_transaction_action",
			args: {
				user_id: frappe.session.user,
				transaction_name: frm.doc.name,
				type: "Topic",
				details: "",
				transaction_scope: frm.doc.transaction_scope || "",
			},
			callback: function (r) {
				if (r.message) {
					// console.log(r.message);
					if (r.message) {
						location.reload();
					}
					// frappe.db.set_value('Transaction', frm.docname, 'status', 'Approved');
				}
			},
		});
	});
}

function add_received_action(frm) {
	cur_frm.page.add_action_item(__("Received"), function () {
		console.log("Transaction Name:", frm.doc.name);
		console.log("Recipient Email:", frappe.session.user);

		// console.log(global_action_name)
		// console.log(global_print_papaer)
		// console.log(global_is_received)
		console.log(global_recipient_docname);
		frappe.call({
			method: "academia.transaction_management.doctype.transaction.transaction.change_is_received_in_action_recipients",
			args: {
				transaction_name: frm.doc.name,
				recipient_email: frappe.session.user,
			},
			callback: function (r) {
				if (r.message) {
					location.reload();
					console.log(r.message);
				}
			},
			error: function (r) {
				frappe.show_alert({
					message: __("Error updating received status"),
					indicator: "red",
				});
			},
		});
	});
}

function add_approve_action(frm) {
	cur_frm.page.add_action_item(__("Approve"), function () {
		if (global_print_papaer) {
			frappe.prompt(
				[
					{
						label: "Details",
						fieldname: "details",
						fieldtype: "Text",
					},
					{
						fieldname: "transaction_name",
						fieldtype: "Link",
						label: "Transaction Name",
						options: "Transaction",
						default: frm.doc.name,
						read_only: 1,
					},
					{
						fieldname: "start_employee",
						fieldtype: "Link",
						label: "Start From",
						options: "Employee",
						read_only: 1,
						default: global_current_employee || "",
					},
					{
						fieldname: "end_employee",
						fieldtype: "Link",
						label: "End To",
						options: "Employee",
						default: global_next_recipient || "",
						read_only: 1,
					},
					{
						fieldname: "through_middle_man",
						fieldtype: "Check",
						label: "Through Middle Man",
					},
					{
						fieldname: "middle_man",
						fieldtype: "Link",
						label: "Middle Man",
						options: "Employee",
						depends_on: "eval:doc.through_middle_man == 1",
						get_query: function () {
							return {
								query: "academia.transaction_management.doctype.transaction.transaction.get_employee_list",
							};
						},
					},
				],
				function (values) {
					if (values.through_middle_man && !values.middle_man) {
						frappe.msgprint({
							title: __("Error"),
							indicator: "red",
							message: __("Please select a Middle Man."),
						});
						return;
					}

					frappe.call({
						method: "academia.transaction_management.doctype.transaction.transaction.create_new_transaction_action",
						args: {
							user_id: frappe.session.user,
							transaction_name: frm.doc.name,
							type: "Approved",
							details: values.details || "",
							transaction_scope: frm.doc.transaction_scope || "",
						},
						callback: function (r) {
							if (r.message) {
								console.log(r.message);
								global_action_name = r.message.action_name;
								console.log(global_action_name);
								const start_employee = frappe.session.user;

								// Fetch the next recipient based on the next step
								frappe.call({
									method: "academia.transaction_management.doctype.transaction.transaction.get_next_recipient_by_step",
									args: {
										transaction_name: values.transaction_name,
										current_employee: start_employee,
									},
									callback: function (r) {
										if (r.message) {
											const end_employee = r.message;

											// Call the server-side method to create the transaction paper log
											frappe.call({
												method: "academia.transaction_management.doctype.transaction.transaction.create_transaction_paper_log",
												args: {
													start_employee: values.start_employee,
													end_employee: values.end_employee,
													transaction_name: values.transaction_name,
													action_name: global_action_name,
													middle_man: values.middle_man,
													through_middle_man: values.through_middle_man
														? "True"
														: "False",
												},
												callback: function (r) {
													if (r.message) {
														console.log(
															"Transaction Paper Log created:",
															r.message
														);
														if (r.message) {
															location.reload();
														}
													}
												},
												error: function (r) {
													console.error(r);
													frappe.msgprint({
														title: __("Error"),
														indicator: "red",
														message: r.message,
													});
												},
											});
										} else {
											frappe.msgprint(__("No next recipient found."));
										}
									},
									error: function (r) {
										console.error(r);
									},
								});
								// if (r.message) {
								// 	location.reload();
								// }
								// frappe.db.set_value('Transaction', frm.docname, 'status', 'Approved');
							}
						},
					});
				},
				__("Enter Approval Details"),
				__("Submit")
			);
		} else {
			frappe.prompt(
				[
					{
						label: "Details",
						fieldname: "details",
						fieldtype: "Text",
					},
				],
				function (values) {
					frappe.call({
						method: "academia.transaction_management.doctype.transaction.transaction.create_new_transaction_action",
						args: {
							user_id: frappe.session.user,
							transaction_name: frm.doc.name,
							type: "Approved",
							details: values.details || "",
							transaction_scope: frm.doc.transaction_scope || "",
						},
						callback: function (r) {
							if (r.message) {
								// console.log(r.message);
								if (r.message) {
									location.reload();
								}
								// frappe.db.set_value('Transaction', frm.docname, 'status', 'Approved');
							}
						},
					});
				},
				__("Enter Approval Details"),
				__("Submit")
			);
		}
	});
}

function add_reject_action(frm) {
	cur_frm.page.add_action_item(__("Reject"), function () {
		frappe.prompt(
			[
				{
					label: "Details",
					fieldname: "details",
					fieldtype: "Text",
				},
			],
			function (values) {
				frappe.call({
					method: "academia.transaction_management.doctype.transaction.transaction.create_new_transaction_action",
					args: {
						user_id: frappe.session.user,
						transaction_name: frm.doc.name,
						type: "Rejected",
						details: values.details || "",
						transaction_scope: frm.doc.transaction_scope || "",
					},
					callback: function (r) {
						if (r.message) {
							location.reload();
							// frappe.db.set_value('Transaction', frm.docname, 'status', 'Rejected');
						}
					},
				});
			},
			__("Enter Rejection Details"),
			__("Submit")
		);
	});
}

function get_cateory_doctype(frm) {
	if (frm.doc.sub_category) {
		frappe.call({
			method: "academia.transaction_management.doctype.transaction.transaction.get_category_doctype",
			args: {
				sub_category: frm.doc.sub_category,
			},
			callback: function (r) {
				if (r.message) {
					frm.set_value("referenced_doctype", r.message);
				}
			},
		});
	} else {
		frm.set_value("referenced_doctype", "");
		frm.set_value("referenced_document", "");
	}
}

function get_default_template(frm) {
	if (frm.doc.referenced_doctype && frm.doc.referenced_document && frm.doc.sub_category) {
		frappe.call({
			method: "academia.transaction_management.doctype.transaction.transaction.render_template",
			args: {
				referenced_doctype: frm.doc.referenced_doctype,
				referenced_document: frm.doc.referenced_document,
				sub_category: frm.doc.sub_category,
			},
			callback: function (r) {
				if (r.message) {
					frm.set_value("transaction_description", r.message);
				} else {
					frappe.msgprint(__("Error rendering template"));
				}
			},
		});
	} else {
		frm.set_value("transaction_description", "");
	}
}

function update_must_include(frm) {
	if (frm.doc.start_with) {
		frm.clear_table("recipients");
		frm.refresh_field("recipients");

		if (frm.doc.transaction_scope === "Among Companies") {
			frappe.call({
				method: "academia.transaction_management.doctype.transaction.transaction.get_all_employees_except_start_with_company",
				args: {
					start_with_company: frm.doc.start_with_company,
				},
				callback: function (response) {
					mustInclude = response.message;
				},
			});
		} else if (frm.doc.through_route) {
			frappe.call({
				method: "academia.transaction_management.doctype.transaction.transaction.get_reports_hierarchy",
				args: {
					employee_name: frm.doc.start_with,
				},
				callback: function (response) {
					mustInclude = response.message;
				},
			});
		} else {
			frappe.call({
				method: "academia.transaction_management.doctype.transaction.transaction.get_reports_hierarchy_reverse",
				args: {
					employee_name: frm.doc.start_with,
				},
				callback: function (response) {
					mustInclude = response.message;
				},
			});
		}
	}
}

frappe.ui.form.on("Transaction Applicant", {
	applicant_type: function (frm, cdt, cdn) {
		let child = locals[cdt][cdn];
		frappe.model.set_value(cdt, cdn, "applicant", "");
		frappe.model.set_value(cdt, cdn, "applicant_name", "");
		applicant_company = "";
	},

	applicant: function (frm, cdt, cdn) {
		let child = locals[cdt][cdn];

		// Fetch the intended name and add it to applicant_name field
		if (child.applicant_type == "Employee") {
			// Fetch employee name
			frappe.db.get_value(
				child.applicant_type,
				child.applicant,
				["employee_name", "company"],
				function (r) {
					if (r) {
						frappe.model.set_value(cdt, cdn, "applicant_name", r.employee_name);
						global_applicant_company = r.company;
					} else {
						frappe.msgprint("Employee name not found");
					}
				}
			);
		} else if (child.applicant_type == "User") {
			// Fetch user name
			frappe.db.get_value(child.applicant_type, child.applicant, "full_name", function (r) {
				// Does not have company
				if (r) {
					frappe.model.set_value(cdt, cdn, "applicant_name", r.full_name);
				} else {
					frappe.msgprint("User name not found");
				}
			});
		} else if (child.applicant_type == "Faculty Member") {
			//Fetch faculty memeber name
			frappe.db.get_value(
				child.applicant_type,
				child.applicant,
				["faculty_member_name", "company"],
				function (r) {
					if (r) {
						frappe.model.set_value(cdt, cdn, "applicant_name", r.faculty_member_name);
						global_applicant_company = r.company;
						frappe.msgprint(applicant_company);
					} else {
						frappe.msgprint("Faculty member name not found");
					}
				}
			);
		} else if (child.applicant_type == "Student") {
			// Fetch student name
			frappe.db.get_value(
				child.applicant_type,
				child.applicant,
				["first_name", "middle_name", "last_name"],
				function (r) {
					if (r) {
						let full_name = [r.first_name, r.middle_name, r.last_name]
							.filter(Boolean)
							.join(" ");
						frappe.model.set_value(cdt, cdn, "applicant_name", full_name);
					} else {
						frappe.msgprint("Student name not found");
					}
				}
			);
		}

		// Bring the intended recipients if sub_category and the applicant have been set
		// if (frm.doc.sub_category && child.applicant) {
		// 	global_recipient_designation.forEach(function (row) {
		// 		frappe.call({
		// 			method: "frappe.client.get_list",
		// 			args: {
		// 				doctype: "Employee",
		// 				filters: {
		// 					designation: row.designation,
		// 					company: global_applicant_company,
		// 				},
		// 				fields: ["name", "employee_name"],
		// 			},
		// 			callback: function (response) {
		// 				var employees = response.message;
		// 				// frappe.msgprint(global_applicant_company);

		// 				if (employees.length > 0) {
		// 					employees.forEach(function (employee) {
		// 						frappe.msgprint(
		// 							`Employee ID: ${employee.name}, Employee Name: ${employee.employee_name}`
		// 						);
		// 					});
		// 				} else {
		// 					frappe.msgprint(
		// 						`No employees found for designation ${row.designation} in company ${company_name}`
		// 					);
		// 				}
		// 			},
		// 		});
		// 	});
		// }
	},
});

frappe.ui.form.on("Transaction Recipients", {
	form_render: function (frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		recipient_designation = row.recipient_designation;
		row.recipient_designation = recipient_designation;
		// frappe.msgprint(
		// 	"Handler Triggered - Recipient Designation Changed: " + row.recipient_designation
		// );
		frm.refresh_field("recipients");

		frm.fields_dict["recipients"].grid.get_field("recipient").get_query = function () {
			return {
				filters: {
					designation: recipient_designation,
					// 'company': frm.doc.company
				},
			};
		};
	},
});

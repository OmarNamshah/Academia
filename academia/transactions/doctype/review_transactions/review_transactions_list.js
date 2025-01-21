frappe.listview_settings['Review Transactions'] = {
    onload: function(listview) {
        $('.btn-primary').filter(function () {
            return $(this).text().trim() === 'Add Review Transactions';
        }).hide();

        if(!frappe.user_roles.includes('Transactions Manager')) {
            frappe.call({
                method: 'academia.transactions.doctype.review_transactions.review_transactions.get_shared_reviews',
                args: {
                    user: frappe.session.user
                },
                callback: function(response) {
                    if (response.message) {
                        const allowed_reviews = response.message;
                        listview.filter_area.add([
                            ['Review Transactions', 'name', 'in', allowed_reviews]
                        ]);
    
                        $('.filter-selector').hide();
                    }
                }
            });
        }
    }
};